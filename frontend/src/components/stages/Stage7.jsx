import React, { useState, useEffect } from 'react';
import {
  Card, Button, List, Typography, Space, message, Spin, Modal, Input,
  Tooltip, Tag, Collapse, Alert, Progress
} from 'antd';
import {
  CodeOutlined, ReloadOutlined, ArrowLeftOutlined, AuditOutlined,
  CheckCircleOutlined, WarningOutlined, CloseCircleOutlined, BulbOutlined
} from '@ant-design/icons';
import Editor from '@monaco-editor/react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { useWorkflowStore, useAuthStore } from '../../store';
import { useWorkflowNavigation } from '../../hooks/useWorkflowNavigation';

const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:5000';
const { Title, Text } = Typography;
const { TextArea } = Input;

export default function Stage7() {
  const { workflow, advanceStage } = useWorkflowStore();
  const { user: currentUser } = useAuthStore();
  const { goToStage } = useWorkflowNavigation();

  const [scripts, setScripts] = useState([]);
  const [totalAutomatable, setTotalAutomatable] = useState(0);
  const [selectedScript, setSelectedScript] = useState(null);
  const [generating, setGenerating] = useState(false);

  // Regenerate modal state
  const [regenVisible, setRegenVisible] = useState(false);
  const [regenFeedback, setRegenFeedback] = useState('');
  const [regenerating, setRegenerating] = useState(false);
  const [regenFromReview, setRegenFromReview] = useState(false);

  // Per-script AI Review state
  const [reviewing, setReviewing] = useState(false);
  const [reviewResult, setReviewResult] = useState(null);
  const [prevReviewResult, setPrevReviewResult] = useState(null);
  const [reviewScriptId, setReviewScriptId] = useState(null);

  // Batch (all scripts) AI Review state
  const [batchReviewing, setBatchReviewing] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);
  const [batchResults, setBatchResults] = useState([]); // [{filename, score, verdict, issues}]
  const [expandedBatch, setExpandedBatch] = useState(new Set()); // indices of expanded rows

  useEffect(() => {
    loadScripts();
    // Check if generation is already running server-side (survives page reload)
    axios.get(`${API}/stage7/status/${workflow?.id}`).then(({ data }) => {
      if (data.generating) setGenerating(true);
    }).catch(() => {});
    const socket = io(WS_URL);
    socket.on(`script-progress-${workflow?.id}`, () => loadScripts());
    // When generation finishes server-side, refresh and unlock
    socket.on(`scripts-done-${workflow?.id}`, () => {
      setGenerating(false);
      loadScripts();
    });
    return () => socket.disconnect();
  }, [workflow?.id]);

  const loadScripts = async () => {
    const { data } = await axios.get(`${API}/stage7/${workflow?.id}`);
    const list = data.scripts ?? data; // backward compat
    setScripts(list);
    if (data.totalAutomatable !== undefined) setTotalAutomatable(data.totalAutomatable);
    if (list.length > 0 && !selectedScript) setSelectedScript(list[0]);
  };

  const handleGenerate = async () => {
    if (generating) return;
    setGenerating(true);
    try {
      await axios.post(`${API}/stage7/generate`, { workflow_id: workflow.id });
      await loadScripts();
      message.success('TCL scripts generated!');
    } catch (err) {
      const reason = err.response?.data?.error || err.message;
      if (err.response?.status === 409) {
        message.warning('Generation already in progress — please wait.');
      } else {
        message.error(`Script generation failed: ${reason}`);
      }
    }
    setGenerating(false);
  };

  const handleEditScript = async (value) => {
    if (!selectedScript) return;
    setSelectedScript(s => ({ ...s, content: value }));
    await axios.put(`${API}/stage7/amend`, { script_id: selectedScript.id, content: value });
  };

  // Open modal pre-filled with empty feedback
  const openRegenModal = () => {
    setRegenFeedback('');
    setRegenVisible(true);
  };

  // Submit regenerate with feedback
  const handleRegenerate = async () => {
    if (!selectedScript) return;
    setRegenerating(true);
    const scriptId = selectedScript.id;
    const wasFromReview = regenFromReview;
    try {
      const { data } = await axios.post(`${API}/stage7/regenerate`, {
        script_id: scriptId,
        user_feedback: regenFeedback.trim()
      });
      setSelectedScript(s => ({ ...s, content: data.content }));
      setScripts(prev => prev.map(sc =>
        sc.id === scriptId ? { ...sc, content: data.content } : sc
      ));
      setRegenVisible(false);
      setRegenFromReview(false);

      if (wasFromReview) {
        // Auto-review the fixed script so user sees before/after
        message.loading({ content: 'Re-reviewing fixed script...', key: 'rereview', duration: 0 });
        setReviewing(true);
        setReviewScriptId(scriptId);
        try {
          const { data: rd } = await axios.post(`${API}/stage7/review`, { script_id: scriptId });
          setPrevReviewResult(reviewResult); // save old review as "before"
          setReviewResult(rd);
          message.success({ content: `Script fixed & re-reviewed — new score: ${rd.review.score}/100`, key: 'rereview', duration: 4 });
        } catch {
          message.error({ content: 'Re-review failed after fix.', key: 'rereview' });
        }
        setReviewing(false);
      } else {
        message.success(`Script "${data.filename}" regenerated!`);
      }
    } catch (err) {
      message.error(err.response?.data?.error || 'Regeneration failed.');
      setRegenFromReview(false);
    }
    setRegenerating(false);
  };

  // Run AI review on current script
  const handleAiReview = async () => {
    if (!selectedScript) return;
    setReviewing(true);
    setReviewResult(null);
    setReviewScriptId(selectedScript.id);
    try {
      const { data } = await axios.post(`${API}/stage7/review`, { script_id: selectedScript.id });
      setReviewResult(data);
    } catch (err) {
      message.error(err.response?.data?.error || 'Review failed.');
    }
    setReviewing(false);
  };

  const handleAssignReviewers = async () => {};
  const loadApprovalStatus = async () => {};

  const handleProceed = async () => {
    try {
      await advanceStage();
      goToStage(8);
    } catch {
      message.error('Failed to proceed to TC Execution.');
    }
  };

  // Batch AI review — reviews every script sequentially
  const handleBatchReview = async () => {
    if (scripts.length === 0) return;
    setBatchReviewing(true);
    setBatchResults([]);
    setBatchProgress(0);
    setExpandedBatch(new Set());
    const results = new Array(scripts.length);
    let completed = 0;
    const CONCURRENCY = 3;

    const reviewOne = async (i) => {
      try {
        const { data } = await axios.post(`${API}/stage7/review`, { script_id: scripts[i].id, batch: true });
        results[i] = { filename: scripts[i].filename, ...data.review };
      } catch (err) {
        const reason = err.response?.data?.error || err.message || 'API error';
        results[i] = { filename: scripts[i].filename, verdict: 'ERROR', score: 0, summary: `Review failed: ${reason}`, issues: [] };
      }
      completed++;
      setBatchProgress(Math.round((completed / scripts.length) * 100));
      setBatchResults([...results].filter(Boolean));
    };

    // Process in chunks of CONCURRENCY
    for (let i = 0; i < scripts.length; i += CONCURRENCY) {
      const chunk = scripts.slice(i, i + CONCURRENCY).map((_, j) => reviewOne(i + j));
      await Promise.all(chunk);
    }

    setBatchReviewing(false);
    message.success(`Reviewed ${scripts.length} scripts.`);
  };

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Button icon={<ArrowLeftOutlined />} onClick={() => goToStage(4)}>
          Previous
        </Button>
        <Button
          type="primary"
          icon={<CodeOutlined />}
          onClick={handleGenerate}
          loading={generating}
        >
          Generate All TCL Scripts
        </Button>
        {generating && <Spin />}
      </Space>

      <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
        {/* Script list */}
        <Card title="Scripts" size="small" style={{ width: 220, flexShrink: 0, overflow: 'auto', maxHeight: 480 }}>
          <List
            size="small"
            dataSource={scripts}
            renderItem={s => (
              <List.Item
                key={s.id}
                style={{
                  cursor: 'pointer',
                  background: selectedScript?.id === s.id ? '#e6f7ff' : 'transparent',
                  padding: '4px 8px',
                  borderRadius: 4
                }}
                onClick={() => setSelectedScript(s)}
              >
                <Text style={{ fontSize: 12 }}>{s.filename}</Text>
              </List.Item>
            )}
          />
        </Card>

        {/* Editor panel */}
        <Card
          title={
            <Space>
              <span>{selectedScript?.filename || 'Select a script'}</span>
              {selectedScript && (
                <>
                  <Tooltip title="Regenerate this script with AI using your feedback">
                    <Button size="small" icon={<ReloadOutlined />} onClick={openRegenModal}>
                      Regenerate
                    </Button>
                  </Tooltip>
                  <Tooltip title="Have the Senior EXOS Networking Architect AI agent review this script">
                    <Button
                      size="small"
                      icon={<AuditOutlined />}
                      onClick={handleAiReview}
                      loading={reviewing && reviewScriptId === selectedScript.id}
                      type="dashed"
                      style={{ borderColor: '#722ed1', color: '#722ed1' }}
                    >
                      AI Review
                    </Button>
                  </Tooltip>
                </>
              )}
            </Space>
          }
          style={{ flex: 1, minHeight: 480 }}
        >
          {selectedScript ? (
            <Editor
              height="380px"
              language="tcl"
              value={selectedScript.content}
              onChange={handleEditScript}
              theme="vs-dark"
              options={{ minimap: { enabled: false }, fontSize: 13 }}
            />
          ) : (
            <Text type="secondary">
              Generate scripts or select one from the list to view and edit.
            </Text>
          )}

          {/* AI Review Results Panel */}
          {reviewResult && reviewScriptId === selectedScript?.id && (
            <ReviewPanel
              result={reviewResult}
              prevResult={prevReviewResult}
              onApplyFixes={() => {
                const issues = reviewResult.review.issues || [];
                const feedback = issues
                  .filter(i => i.severity === 'CRITICAL' || i.severity === 'WARNING')
                  .map(i => `• [${i.severity}] ${i.description}`)
                  .join('\n');
                setRegenFeedback(`Fix these issues found by the EXOS Architect review:\n${feedback}`);
                setRegenFromReview(true);
                setRegenVisible(true);
              }}
              onDismiss={() => { setReviewResult(null); setPrevReviewResult(null); }}
            />
          )}
        </Card>
      </div>

      {/* AI Review — All Scripts */}
      <Card
        title={
          <Space>
            <AuditOutlined style={{ color: '#722ed1' }} />
            <span>AI Review — All Scripts</span>
            {batchResults.length > 0 && (
              <Tag color="purple">{batchResults.length} reviewed</Tag>
            )}
          </Space>
        }
        style={{ marginBottom: 16 }}
        extra={
          <Button
            icon={<AuditOutlined />}
            onClick={handleBatchReview}
            loading={batchReviewing}
            disabled={scripts.length === 0}
            style={{ borderColor: '#722ed1', color: '#722ed1' }}
          >
            {batchReviewing
              ? `Reviewing... ${batchProgress}%`
              : 'Review All Scripts'}
          </Button>
        }
      >
        {batchReviewing && (
          <Progress percent={batchProgress} strokeColor="#722ed1" style={{ marginBottom: 12 }} />
        )}

        {batchResults.length === 0 && !batchReviewing && (
          <Text type="secondary">
            Click <strong>Review All Scripts</strong> to have the Senior EXOS Networking Architect
            AI agent analyze every generated script and produce a quality report.
          </Text>
        )}

        {batchResults.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {batchResults.map((r, idx) => {
              const vc = VERDICT_CONFIG[r.verdict] || VERDICT_CONFIG.NEEDS_REVISION;
              const scoreColor = r.score >= 80 ? '#52c41a' : r.score >= 60 ? '#faad14' : '#ff4d4f';
              const criticals   = (r.issues || []).filter(i => i.severity === 'CRITICAL');
              const warnings    = (r.issues || []).filter(i => i.severity === 'WARNING');
              const suggestions = (r.issues || []).filter(i => i.severity === 'SUGGESTION');
              const isOpen = expandedBatch.has(idx);
              const hasIssues = (r.issues || []).length > 0;
              return (
                <div key={idx} style={{ border: '1px solid #303030', borderRadius: 6, overflow: 'hidden' }}>
                  {/* Header row */}
                  <div
                    style={{ display: 'flex', alignItems: 'center', padding: '7px 12px', gap: 8, cursor: hasIssues ? 'pointer' : 'default', background: '#1a1a1a' }}
                    onClick={() => {
                      if (!hasIssues) return;
                      setExpandedBatch(prev => {
                        const next = new Set(prev);
                        next.has(idx) ? next.delete(idx) : next.add(idx);
                        return next;
                      });
                    }}
                  >
                    {/* Expand arrow */}
                    <span style={{ color: '#888', fontSize: 11, width: 14, flexShrink: 0, transition: 'transform 0.2s', display: 'inline-block', transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                      {hasIssues ? '▶' : '·'}
                    </span>
                    <Text code style={{ fontSize: 12, flexShrink: 0 }}>{r.filename}</Text>
                    <Text type="secondary" style={{ fontSize: 11, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.summary}</Text>
                    <Space size={4} style={{ flexShrink: 0 }}>
                      {criticals.length   > 0 && <Tag color="error"   style={{ margin: 0 }}>{criticals.length} Critical</Tag>}
                      {warnings.length    > 0 && <Tag color="warning"  style={{ margin: 0 }}>{warnings.length} Warning</Tag>}
                      {suggestions.length > 0 && <Tag color="blue"     style={{ margin: 0 }}>{suggestions.length} Tip</Tag>}
                      <Tag color={vc.color} style={{ margin: 0 }}>{vc.label}</Tag>
                      <span style={{ fontWeight: 700, color: scoreColor, minWidth: 42, textAlign: 'right', fontSize: 13 }}>{r.score}/100</span>
                      <Button
                        size="small"
                        type="primary"
                        ghost
                        style={{ marginLeft: 4, fontSize: 11 }}
                        onClick={e => {
                          e.stopPropagation();
                          const sc = scripts.find(s => s.filename === r.filename);
                          if (sc) {
                            setSelectedScript(sc);
                            const issueLines = (r.issues || []).map(i => `[${i.severity}] ${i.category}: ${i.description}${i.line_hint ? ' → ' + i.line_hint : ''}`).join('\n');
                            setRegenFeedback(`Fix these issues found by AI review:\n\n${issueLines}`);
                            setRegenFromReview(true);
                            setRegenVisible(true);
                          }
                        }}
                      >
                        Improve
                      </Button>
                    </Space>
                  </div>
                  {/* Expanded issues */}
                  {isOpen && hasIssues && (
                    <div style={{ padding: '8px 12px 8px 36px', display: 'flex', flexDirection: 'column', gap: 5, background: '#111' }}>
                      {(r.issues || []).map((issue, ii) => {
                        const cfg = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.SUGGESTION;
                        return (
                          <div key={ii} style={{ background: cfg.bg, border: `1px solid ${cfg.color}44`, borderRadius: 5, padding: '5px 10px' }}>
                            <Space size={4} wrap>
                              <span style={{ color: cfg.color }}>{cfg.icon}</span>
                              <Tag color={cfg.tagColor} style={{ fontSize: 11, margin: 0 }}>{issue.severity}</Tag>
                              <Tag style={{ fontSize: 11, margin: 0 }}>{issue.category}</Tag>
                              <Text style={{ fontSize: 12 }}>{issue.description}</Text>
                            </Space>
                            {issue.line_hint && (
                              <div style={{ marginTop: 3, marginLeft: 20 }}>
                                <Text code style={{ fontSize: 11, color: '#aaa' }}>{issue.line_hint}</Text>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Proceed to TC Execution */}
      <Space style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<CheckCircleOutlined />}
          disabled={generating || scripts.length === 0 || scripts.length < totalAutomatable}
          title={generating ? 'Script generation in progress…' : scripts.length < totalAutomatable ? `${scripts.length}/${totalAutomatable} scripts generated` : ''}
          onClick={handleProceed}
        >
          {generating
            ? `Generating scripts… please wait`
            : scripts.length < totalAutomatable
            ? `Waiting for scripts… (${scripts.length}/${totalAutomatable})`
            : 'Proceed to TC Execution'}
        </Button>
      </Space>

      {/* Regenerate Modal */}
      <Modal
        title={
          <Space>
            <ReloadOutlined />
            Regenerate: {selectedScript?.filename}
          </Space>
        }
        open={regenVisible}
        onCancel={() => setRegenVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setRegenVisible(false)}>
            Cancel
          </Button>,
          <Button
            key="regen"
            type="primary"
            icon={<ReloadOutlined />}
            loading={regenerating}
            onClick={handleRegenerate}
          >
            Regenerate Script
          </Button>
        ]}
        width={600}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Text>
            Describe what to change or fix in the current script. The AI will use your
            instructions plus the original test plan steps to regenerate the script.
            Leave blank to regenerate with improved quality only.
          </Text>
          <TextArea
            rows={6}
            placeholder={
              'Examples:\n' +
              '• Use IGMPv3 instead of IGMPv2 for the multicast join\n' +
              '• Add traffic rate verification after the failover step\n' +
              '• The cleanup section is missing — add delete commands\n' +
              '• Fix the CheckKeyValue patterns to use curly braces'
            }
            value={regenFeedback}
            onChange={e => setRegenFeedback(e.target.value)}
          />
        </Space>
      </Modal>
    </div>
  );
}

// ─── ReviewPanel ─────────────────────────────────────────────────────────────

const SEVERITY_CONFIG = {
  CRITICAL: { color: '#ff4d4f', bg: '#fff1f0', icon: <CloseCircleOutlined />, tagColor: 'error' },
  WARNING:  { color: '#faad14', bg: '#fffbe6', icon: <WarningOutlined />,      tagColor: 'warning' },
  SUGGESTION: { color: '#1677ff', bg: '#e6f4ff', icon: <BulbOutlined />,      tagColor: 'processing' },
};

const VERDICT_CONFIG = {
  PASS:           { color: 'success', label: 'PASS',           alertType: 'success' },
  NEEDS_REVISION: { color: 'warning', label: 'NEEDS REVISION', alertType: 'warning' },
  FAIL:           { color: 'error',   label: 'FAIL',           alertType: 'error' },
};

function ReviewPanel({ result, prevResult, onApplyFixes, onDismiss }) {
  const { review, tc_number, filename } = result;
  const vc = VERDICT_CONFIG[review.verdict] || VERDICT_CONFIG.NEEDS_REVISION;
  const criticals   = (review.issues || []).filter(i => i.severity === 'CRITICAL');
  const warnings    = (review.issues || []).filter(i => i.severity === 'WARNING');
  const suggestions = (review.issues || []).filter(i => i.severity === 'SUGGESTION');
  const hasFixable  = criticals.length + warnings.length > 0;

  const scoreColor = review.score >= 80 ? '#52c41a' : review.score >= 60 ? '#faad14' : '#ff4d4f';

  // Before/after delta when this is a post-fix re-review
  const scoreDelta  = prevResult ? review.score - prevResult.review.score : null;
  const prevIssues  = prevResult ? (prevResult.review.issues || []).length : null;
  const nowIssues   = (review.issues || []).length;
  const fixedCount  = prevIssues !== null ? Math.max(0, prevIssues - nowIssues) : null;

  return (
    <div style={{ marginTop: 16, border: '1px solid #d9d9d9', borderRadius: 8, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        background: '#1e1e2e', color: '#cdd6f4', padding: '10px 16px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between'
      }}>
        <Space>
          <AuditOutlined style={{ color: '#cba6f7' }} />
          <Typography.Text style={{ color: '#cba6f7', fontWeight: 600 }}>
            Senior EXOS Networking Architect Review
          </Typography.Text>
          <Typography.Text style={{ color: '#6c7086', fontSize: 12 }}>
            {filename}
          </Typography.Text>
          {prevResult && (
            <Tag color="purple" style={{ fontSize: 11 }}>Post-Fix Re-Review</Tag>
          )}
        </Space>
        <Space>
          <Tag color={vc.color}>{vc.label}</Tag>
          <Button size="small" type="text" style={{ color: '#6c7086' }} onClick={onDismiss}>✕</Button>
        </Space>
      </div>

      <div style={{ padding: 16, background: '#fafafa' }}>

        {/* Before / After banner — only shown after a fix */}
        {prevResult && (
          <div style={{
            display: 'flex', gap: 12, marginBottom: 14, padding: '10px 14px',
            background: '#f0f5ff', borderRadius: 8, border: '1px solid #adc6ff',
            alignItems: 'center'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 2 }}>Before fix</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: prevResult.review.score >= 80 ? '#52c41a' : prevResult.review.score >= 60 ? '#faad14' : '#ff4d4f' }}>
                {prevResult.review.score}
              </div>
              <Tag color={VERDICT_CONFIG[prevResult.review.verdict]?.color || 'default'} style={{ fontSize: 10 }}>
                {VERDICT_CONFIG[prevResult.review.verdict]?.label || prevResult.review.verdict}
              </Tag>
            </div>

            <div style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 20, color: scoreDelta >= 0 ? '#52c41a' : '#ff4d4f' }}>
                {scoreDelta >= 0 ? '▲' : '▼'} {Math.abs(scoreDelta)} pts
              </div>
              {fixedCount > 0 && (
                <div style={{ fontSize: 12, color: '#52c41a' }}>
                  <CheckCircleOutlined /> {fixedCount} issue{fixedCount > 1 ? 's' : ''} resolved
                </div>
              )}
              {nowIssues > prevIssues && (
                <div style={{ fontSize: 12, color: '#faad14' }}>
                  <WarningOutlined /> {nowIssues - prevIssues} new issue{nowIssues - prevIssues > 1 ? 's' : ''} found
                </div>
              )}
            </div>

            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: '#8c8c8c', marginBottom: 2 }}>After fix</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: scoreColor }}>
                {review.score}
              </div>
              <Tag color={vc.color} style={{ fontSize: 10 }}>{vc.label}</Tag>
            </div>
          </div>
        )}

        {/* Score + Summary */}
        <div style={{ display: 'flex', gap: 16, marginBottom: 12, alignItems: 'flex-start' }}>
          <div style={{ textAlign: 'center', minWidth: 80 }}>
            <Progress
              type="circle"
              percent={review.score}
              size={72}
              strokeColor={scoreColor}
              format={p => <span style={{ color: scoreColor, fontWeight: 700, fontSize: 16 }}>{p}</span>}
            />
            <div style={{ fontSize: 11, color: '#8c8c8c', marginTop: 4 }}>Score</div>
          </div>
          <Alert
            type={vc.alertType}
            message={review.summary}
            style={{ flex: 1, marginBottom: 0 }}
            showIcon
          />
        </div>

        {/* Issues */}
        {review.issues && review.issues.length > 0 && (
          <Collapse
            size="small"
            style={{ marginBottom: 12 }}
            defaultActiveKey={criticals.length > 0 ? ['critical'] : []}
            items={[
              criticals.length > 0 && {
                key: 'critical',
                label: <Space><CloseCircleOutlined style={{ color: '#ff4d4f' }} /><span style={{ color: '#ff4d4f', fontWeight: 600 }}>Critical Issues ({criticals.length})</span></Space>,
                children: <IssueList items={criticals} />
              },
              warnings.length > 0 && {
                key: 'warning',
                label: <Space><WarningOutlined style={{ color: '#faad14' }} /><span style={{ color: '#faad14', fontWeight: 600 }}>Warnings ({warnings.length})</span></Space>,
                children: <IssueList items={warnings} />
              },
              suggestions.length > 0 && {
                key: 'suggestion',
                label: <Space><BulbOutlined style={{ color: '#1677ff' }} /><span style={{ color: '#1677ff', fontWeight: 600 }}>Suggestions ({suggestions.length})</span></Space>,
                children: <IssueList items={suggestions} />
              },
            ].filter(Boolean)}
          />
        )}

        {/* All clear */}
        {(!review.issues || review.issues.length === 0) && (
          <Alert
            type="success"
            message="No issues found — script passes all framework checks!"
            icon={<CheckCircleOutlined />}
            showIcon
            style={{ marginBottom: 12 }}
          />
        )}

        {/* Positives */}
        {review.positives && review.positives.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            <Typography.Text strong style={{ fontSize: 12, color: '#52c41a' }}>
              <CheckCircleOutlined /> Well done:
            </Typography.Text>
            <ul style={{ margin: '4px 0 0 16px', padding: 0 }}>
              {review.positives.map((p, i) => (
                <li key={i} style={{ fontSize: 12, color: '#595959' }}>{p}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Actions */}
        {hasFixable && (
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            size="small"
            onClick={onApplyFixes}
            style={{ background: '#722ed1', borderColor: '#722ed1' }}
          >
            Fix Issues with AI (Regenerate + Re-Review)
          </Button>
        )}
      </div>
    </div>
  );
}

function IssueList({ items }) {
  return (
    <div>
      {items.map((issue, i) => (
        <div key={i} style={{
          padding: '6px 10px', marginBottom: 4, borderRadius: 4,
          background: SEVERITY_CONFIG[issue.severity]?.bg || '#f5f5f5',
          borderLeft: `3px solid ${SEVERITY_CONFIG[issue.severity]?.color || '#d9d9d9'}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Tag size="small" color={SEVERITY_CONFIG[issue.severity]?.tagColor}>{issue.category}</Tag>
            <Typography.Text style={{ fontSize: 13 }}>{issue.description}</Typography.Text>
          </div>
          {issue.line_hint && (
            <Typography.Text code style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
              {issue.line_hint}
            </Typography.Text>
          )}
        </div>
      ))}
    </div>
  );
}
