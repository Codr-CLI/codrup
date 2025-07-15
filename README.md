
# codrup

`codrup` is a CLI tool designed to set up and configure the [codr](https://github.com/pshycodr/codr) AI assistant toolchain in a single step.

It handles:
- Cloning the codr repository
- Installing system dependencies (Bun, uv, Python)
- Setting up virtual environments
- Installing Node and Python dependencies
- Prompting for and generating the `.env` configuration
- Linking the CLI globally for system-wide usage

---

## Installation

Install via npm:

```bash
npm install -g codrup
````

---

## Usage

### Initial Setup

```bash
codrup --setup
```

This command will:

* Clone the `codr` repository to `~/.codr`
* Install dependencies
* Prompt for your LLM and API keys
* Link the `codr` CLI globally

After setup, you can use:

```bash
codr
```

from anywhere in your terminal.

---

### Update

To pull the latest changes and refresh dependencies:

```bash
codrup --update
```

---

### Reconfigure Environment

To modify the `.env` or change your LLM/API keys:

```bash
codrup --config
```

---

## Requirements

Make sure you have the following installed (installer will prompt to install if missing):

* `git`
* `python3`
* [`bun`](https://bun.sh/)
* [`uv`](https://github.com/astral-sh/uv)

---

## Related Projects

* [`codr`](https://github.com/pshycodr/codr): The core AI code assistant (agents, CLI tools, RAG, LangGraph, and more)
* [`codrup`](https://github.com/pshycodr/codrup): The CLI setup tool for `codr`

---

## License

Licensed under the [Apache 2.0 License](LICENSE).
