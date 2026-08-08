#!/usr/bin/env python3
"""Patch rolldown to work with Node 16 (polyfill styleText)"""
fp = '/root/networking-qa-workflow/frontend/node_modules/rolldown/dist/shared/rolldown-build-CtPvmZgJ.mjs'
with open(fp) as f:
    content = f.read()
old = 'import { formatWithOptions, styleText } from "node:util";'
new = 'import { formatWithOptions } from "node:util"; const styleText = (fmt, text) => text;'
if old in content:
    content = content.replace(old, new, 1)
    with open(fp, 'w') as f:
        f.write(content)
    print('PATCHED - styleText polyfilled')
elif 'styleText = (fmt, text) => text' in content:
    print('Already patched')
else:
    print('WARNING: pattern not found, check file manually')
