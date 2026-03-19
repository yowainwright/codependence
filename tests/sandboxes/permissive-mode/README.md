# 🔄 Permissive Mode Sandbox

Demonstrates Codependence's powerful permissive mode - update everything to latest EXCEPT what you want to keep.

## What is Permissive Mode?

Instead of specifying what to update, you specify what to PIN. Everything else updates to latest versions.

## Why Use It?

- **Keep React 17**: Update everything except React (avoiding breaking changes)
- **Security fixes**: Update all vulnerable deps except ones with breaking changes
- **Gradual migration**: Update most dependencies, pin problematic ones

## Commands

```bash
# Check current status
npm run check

# Pin React at v17, update everything else
npm run permissive:pin-react

# Pin lodash, update everything else
npm run permissive:pin-lodash

# Interactive mode - choose what to pin
npm run permissive:interactive

# Update all except those in config
npm run permissive:update-all-except
```

## Current Setup

This sandbox has mixed outdated dependencies:
- `react@17.0.2` - Stable but v18 available (breaking changes)
- `lodash@4.17.19` - Has vulnerabilities (needs 4.17.21)
- `axios@0.21.1` - Critical vulnerabilities (needs 1.6.x)
- `moment@2.29.1` - Deprecated, consider alternatives

## Interactive Flow

When running `npm run permissive:interactive`:
1. You'll see ALL dependencies listed
2. Select which ones to PIN (keep at current version)
3. Everything NOT selected updates to latest

## Real-World Example

```bash
# Keep React ecosystem at v17, update everything else
codependence --permissive --codependencies react react-dom react-router --update

# Result:
# ✅ React stays at 17.0.2
# ✅ Everything else updates to latest
# ✅ No breaking React changes
# ✅ All security vulnerabilities fixed (except in pinned deps)
```