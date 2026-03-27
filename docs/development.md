# Development

Building Norbert from source and installing local builds.

## Local install

Use `local_install.sh` to install your local build to `~/.norbert/bin/`:

```bash
# Install from an existing build (src-tauri/target/release/)
./local_install.sh

# Build and install in one step
./local_install.sh --build
```

This copies the binaries, creates shortcuts, and starts the hook receiver — same as the production installer but skipping the GitHub download.
