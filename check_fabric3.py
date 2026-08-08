import yaml, json

with open('/root/NOS-OpenAPI/nos-openapi.yaml') as f:
    spec = yaml.safe_load(f)

schemas = spec.get('components', {}).get('schemas', {})
paths = spec.get('paths', {})

def resolve(ref, schemas, visited=None):
    if visited is None:
        visited = set()
    if not ref:
        return {}
    name = ref.split('/')[-1]
    if name in visited:
        return {'$circular': name}
    visited.add(name)
    s = schemas.get(name, {})
    # inline allOf
    if 'allOf' in s:
        merged = {}
        for part in s['allOf']:
            part = resolve(part.get('$ref',''), schemas, visited) if '$ref' in part else part
            merged.update(part.get('properties', {}))
        s = {'properties': merged}
    return s

def dump_schema(schema, schemas, depth=0, indent=0):
    pad = '  ' * indent
    if '$ref' in schema:
        schema = resolve(schema['$ref'], schemas)
    if 'properties' in schema:
        for k, v in schema['properties'].items():
            vtype = v.get('type', '')
            venum = v.get('enum', [])
            vref  = v.get('$ref', '')
            desc  = v.get('description', '')
            if vref:
                sub = resolve(vref, schemas)
                sub_enum = sub.get('enum', [])
                print(f"{pad}- {k}: (ref:{vref.split('/')[-1]}) enum={sub_enum}  desc={desc[:80]}")
                dump_schema(sub, schemas, depth+1, indent+1)
            elif venum:
                print(f"{pad}- {k}: enum={venum}  desc={desc[:80]}")
            else:
                print(f"{pad}- {k}: {vtype}  desc={desc[:80]}")
    elif 'enum' in schema:
        print(f"{pad}  enum values: {schema['enum']}")

# 1. Dump all fabric-attach related paths and their full schemas
print("=" * 70)
print("ALL FABRIC ATTACH PATHS — FULL SCHEMA DUMP")
print("=" * 70)
for path, item in sorted(paths.items()):
    if 'fabric' not in path.lower():
        continue
    for method, op in item.items():
        if method not in ('get','post','put','patch','delete'):
            continue
        print(f"\n{method.upper()} {path}")
        print(f"  Summary: {op.get('summary','')}")
        # request body
        rb_schema = op.get('requestBody',{}).get('content',{}).get('application/json',{}).get('schema',{})
        if rb_schema:
            print("  REQUEST BODY:")
            dump_schema(rb_schema, schemas, indent=2)
        # response 200
        r200 = op.get('responses',{}).get('200',{}).get('content',{}).get('application/json',{}).get('schema',{})
        if r200:
            print("  RESPONSE (200):")
            dump_schema(r200, schemas, indent=2)

# 2. Search ALL schemas for netlogin / bypass keywords
print("\n" + "=" * 70)
print("SCHEMA SEARCH: netlogin / bypass / netLogin")
print("=" * 70)
keywords = ['netlogin', 'bypass', 'netLogin', 'net-login']
for name, schema in schemas.items():
    text = json.dumps(schema).lower()
    if any(kw.lower() in text for kw in keywords):
        print(f"\nSchema: {name}")
        print(json.dumps(schema, indent=2)[:2000])

# 3. Also search all path/operation text
print("\n" + "=" * 70)
print("PATH/OPERATION SEARCH: netlogin / bypass")
print("=" * 70)
for path, item in paths.items():
    text = json.dumps(item).lower()
    if any(kw.lower() in text for kw in keywords):
        print(f"PATH: {path}")
        print(json.dumps(item, indent=2)[:1000])
        print()
