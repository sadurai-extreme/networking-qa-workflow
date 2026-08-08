import yaml, json

with open('/root/NOS-OpenAPI/nos-openapi.yaml') as f:
    spec = yaml.safe_load(f)

schemas = spec.get('components', {}).get('schemas', {})

def resolve_ref(ref, schemas):
    if not ref:
        return {}
    name = ref.split('/')[-1]
    return schemas.get(name, {})

def get_schema_props(schema, schemas, depth=0):
    if depth > 2:
        return {}
    if '$ref' in schema:
        schema = resolve_ref(schema['$ref'], schemas)
    props = schema.get('properties', {})
    result = {}
    for k, v in props.items():
        if '$ref' in v:
            sub = resolve_ref(v['$ref'], schemas)
            result[k] = {sk: sv.get('type', sv.get('$ref','?')) for sk, sv in sub.get('properties',{}).items()}
        else:
            result[k] = v.get('type', v.get('enum', '?'))
    return result

paths = spec.get('paths', {})
write_ops = ['put','patch','post']

print("=== FABRIC ATTACH — WRITE OPERATIONS (body schemas) ===\n")
for path, item in sorted(paths.items()):
    if 'fabric' not in path.lower():
        continue
    for method in write_ops:
        op = item.get(method)
        if not op:
            continue
        print(f"{method.upper()} {path}")
        print(f"  Summary: {op.get('summary','')}")
        rb = op.get('requestBody',{})
        schema = rb.get('content',{}).get('application/json',{}).get('schema',{})
        if schema:
            props = get_schema_props(schema, schemas)
            print(f"  Body schema:")
            print(f"    {json.dumps(props, indent=4)}")
        print()

print("\n=== FABRIC ATTACH — STATE RESPONSE SCHEMAS ===\n")
for path, item in sorted(paths.items()):
    if 'fabric' not in path.lower() or 'state' not in path:
        continue
    op = item.get('get')
    if not op:
        continue
    r200 = op.get('responses',{}).get('200',{}).get('content',{}).get('application/json',{}).get('schema',{})
    if r200:
        props = get_schema_props(r200, schemas)
        print(f"GET {path}")
        print(f"  Response: {json.dumps(props, indent=4)}")
        print()
