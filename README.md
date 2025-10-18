# Codr Installer (codrup)

[![npm version](https://badge.fury.io/js/codrup.svg)](https://badge.fury.io/js/codrup)
[![npm downloads](https://img.shields.io/npm/dw/codrup.svg)](https://www.npmjs.com/package/codrup)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)


A CLI installer for [Codr](https://github.com/Codr-CLI/cli), the AI development assistant. Handles installation, configuration, and updates with intelligent dependency management.

## Quick Start

```bash
# Install globally
npm install -g codrup

# Set up Codr
codrup --setup

# Start using Codr
codr
```

## Features

- **Automated Installation**: Downloads and configures Codr from GitHub releases
- **Multi-Provider Support**: Configure Claude, Gemini, OpenAI, or DeepSeek
- **Smart Updates**: Automatic version checking with atomic file operations
- **Global Access**: Install once, use anywhere in your terminal
- **Safe Operations**: Built-in error recovery and automatic cleanup

## Commands

### Setup
Install and configure Codr for the first time:
```bash
codrup --setup
```

### Configuration
Update LLM provider or API keys:
```bash
codrup --config
```

### Update
Update to the latest Codr version:
```bash
codrup --update
```

### Reset
Remove Codr installation completely:
```bash
codrup --reset
```
## Requirements

- Node.js 14.x or higher
- npm 6.x or higher
- Internet connection for downloads

## How It Works

Codrup manages Codr installations by:
1. Downloading versioned releases from GitHub
2. Storing installation metadata at `~/.codr/.metadata.json`
3. Generating environment configuration with your API keys
4. Linking Codr globally via npm

All operations use atomic file replacements and include automatic rollback on failure.

## Troubleshooting

**Command not found after installation**
- Restart your terminal
- Check npm global bin path: `npm config get prefix`

**Update fails**
- Verify installation exists: `ls ~/.codr`
- Try reset and reinstall: `codrup --reset` then `codrup --setup`

**Configuration issues**
- Run `codrup --config` to reconfigure
- Check `.env` file at your installation directory

## Related Projects

- [Codr](https://github.com/Codr-CLI/cli) - AI development assistant

## License

Apache License 2.0

---

**Questions?** Open an issue on [GitHub](https://github.com/Codr-CLI/codrup/issues)