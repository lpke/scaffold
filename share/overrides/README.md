# scaffold overrides

Override manifests are declarative action lists applied after an upstream
generator runs.

- `common/defaults.json`: shared defaults for every project.
- `frameworks/<name>.json`: runs after a framework generator, such as Next.js or Nuxt.
- `frontend-bases/<name>.json`: runs after a frontend base generator, such as React or Vue.

Manifests use this shape:

```json
{
  "version": 1,
  "description": "Human-readable purpose.",
  "actions": [
    {
      "type": "file.write",
      "label": "Human-readable action name",
      "path": "src/example.ts",
      "template": "overrides/example.ts"
    }
  ]
}
```

Action `path`, `from`, and `to` values are always project-relative. Absolute
paths and `..` escapes are rejected.

## Conditions

Every action can use `when` and `unless`.

```json
{ "when": "tailwind" }
{ "when": { "answer": "typescript", "equals": true } }
{ "when": { "all": ["tailwind", "typescript"] } }
{ "when": { "any": ["react", "vue"] } }
{ "unless": { "fileExists": "src/App.vue" } }
```

## Content

Text actions accept one of:

- `content`: inline text.
- `template`: path under `share/templates`.
- `asset`: path under `share`.

Uppercase tokens like `{{PROJECT_NAME}}` are replaced from action/context values.
Vue-style template tokens like `{{ msg }}` are left alone.

## File Actions

- `file.write`: write inline/template/asset content to `path`.
- `file.copy`: copy a target file from `from` to `to`.
- `file.copyTemplate`: copy one file from `share/templates`.
- `file.copyAsset`: copy one file from `share`.
- `file.move`: move a target file from `from` to `to`.
- `file.delete`: delete one `path`, or many `paths`.

## Directory Actions

- `dir.ensure`: create a directory.
- `dir.delete`: delete a directory tree.
- `dir.copyTemplate`: copy a directory from `share/templates`.
- `dir.copyAsset`: copy a directory from `share`.
- `dir.clean`: keep a directory, but delete selected contents.

`dir.clean` supports `keep` and `delete` path rules. Rules can be strings,
`path`, `exact`, `prefix`, `glob`, or `regex`.

```json
{
  "type": "dir.clean",
  "path": "src/components",
  "keep": ["HelloWorld.vue", { "regex": "^__tests__/" }]
}
```

With no `delete`, everything not kept is deleted. With `delete`, only matching
paths are candidates for deletion.

## Text Actions

- `text.replace`: literal or regex replacements.
- `text.remove`: replacement shorthand that removes matched text.
- `text.prepend`: add content at the start of a file.
- `text.append`: add content at the end of a file.
- `text.insertBefore`: insert content before a match.
- `text.insertAfter`: insert content after a match.
- `text.mergeLines`: add missing lines without duplicating them.
- `text.removeLines`: remove exact or regex-matched lines.
- `text.setProperties`: set simple `key = value` config properties.
- `text.ensureTrailingNewline`: add a final newline if missing.

Use `skipIfContains` to make text edits idempotent.

## JSON Actions

- `json.set`: set a JSON Pointer path.
- `json.merge`: deep-merge an object into the root or `pointer`.
- `json.delete`: delete a JSON Pointer path.
- `json.patch`: RFC 6902-style `add`, `replace`, `remove`, `copy`, `move`, and `test`.

JSON files are parsed and formatted, not string-edited.
