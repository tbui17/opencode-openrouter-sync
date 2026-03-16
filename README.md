# OpenRouter Model Sync Plugin

A plugin for OpenCode that automatically syncs available models from OpenRouter's public API to your global configuration.

## Features

- Automatic model sync on startup (once per 24 hours)
- Manual sync via `/openrouter-sync` command
- File-based caching for resilience
- No API key required (uses public endpoint)
- Only adds new models, never overwrites existing configurations

## Installation

### Option 1: From npm (recommended)

```bash
npm install -g opencode-openrouter-sync
```

Then add the plugin to your OpenCode config at `~/.config/opencode/opencode.json`:

```json
{
  "plugin": ["opencode-openrouter-sync"]
}
```

### Option 2: From source

Clone this repository and build:

```bash
git clone https://github.com/yourusername/opencode-openrouter-sync.git
cd opencode-openrouter-sync
npm install
npm run build
```

Copy the built plugin to your OpenCode plugins directory:

```bash
mkdir -p ~/.config/opencode/plugins
cp dist/index.js ~/.config/opencode/plugins/openrouter-sync.js
```

Add to your config:

```json
{
  "plugin": ["openrouter-sync"]
}
```

## Usage

### Quick Start

1. Install the plugin:
   ```bash
   npm install -g opencode-openrouter-sync
   ```

2. Add to your OpenCode config (`~/.config/opencode/opencode.json`):
   ```json
   {
     "plugin": ["opencode-openrouter-sync"]
   }
   ```

3. Restart OpenCode — models will sync automatically on first run.

### Automatic Sync

The plugin automatically syncs models on first startup. After that, it checks if 24 hours have passed since the last successful sync and runs automatically when you start OpenCode.

### Manual Sync

Run the manual sync command anytime:

```
/openrouter-sync
```

This forces an immediate sync regardless of when the last sync occurred.

### Programmatic Usage

You can also use the sync functionality programmatically in your own code:

```typescript
import { syncModels, fetchModels } from 'opencode-openrouter-sync';

// Full sync with config
const result = await syncModels();
console.log(`Added ${result.added} models, skipped ${result.skipped}`);

// Fetch models without updating config
const models = await fetchModels();
console.log(`Fetched ${models.length} models from OpenRouter`);
```

### Verifying Sync

After a sync, you can verify the models were added:

```bash
cat ~/.config/opencode/opencode.json | jq '.provider.openrouter.models | keys | length'
```

This should show a number greater than 400, representing all available OpenRouter models.

### Viewing Synced Models

List all synced OpenRouter models:

```bash
cat ~/.config/opencode/opencode.json | jq '.provider.openrouter.models | to_entries | .[].key'
```

Check a specific model:

```bash
cat ~/.config/opencode/opencode.json | jq '.provider.openrouter.models["openai/gpt-4o"]'
```

## Configuration

The plugin works out of the box without any configuration. However, you can customize behavior in your config file.

### Default Config Location

- Global config: `~/.config/opencode/opencode.json`
- Cache directory: `~/.local/share/opencode/openrouter-sync/cache.json`

### Configuration Options

Add options under `provider.openrouter` in your config:

```json
{
  "plugin": ["opencode-openrouter-sync"],
  "provider": {
    "openrouter": {
      "options": {
        "cacheTtl": 86400000,
        "enabled": true
      }
    }
  }
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cacheTtl` | number | 86400000 | Cache TTL in milliseconds (24 hours) |
| `enabled` | boolean | true | Whether to run sync on startup |

### How Models Are Added

The plugin adds models under `provider.openrouter.models` in your global config. Each model includes:

- `id` - Model identifier
- `name` - Human-readable name
- `contextWindow` - Maximum context length
- `pricing` - Input/output pricing information

The sync logic:
- Only adds models that don't already exist
- Never removes or overwrites existing models
- Preserves any custom model configurations you have

## Troubleshooting

### Plugin Not Loading

1. Check that the plugin file exists at `~/.config/opencode/plugins/openrouter-sync.js`
2. Verify the plugin is listed in your config under `"plugin"`
3. Restart OpenCode after making config changes

### Sync Not Running

1. Check OpenCode logs for any error messages
2. Verify you have internet access to reach `openrouter.ai`
3. Try running `/openrouter-sync` manually to see error details

### Models Not Appearing

1. Run `/openrouter-sync` manually
2. Check that `~/.config/opencode/opencode.json` is writable
3. Look for errors in the OpenCode console

### Reset Cache

If you need to force a fresh sync:

```bash
rm ~/.local/share/openrouter-sync/cache.json
```

Then restart OpenCode or run `/openrouter-sync`.

## Development

```bash
# Install dependencies
npm install

# Build the plugin
npm run build

# Run tests
npm test

# Clean build artifacts
npm run clean
```

## License

MIT
