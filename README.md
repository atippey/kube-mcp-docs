# kube-mcp-docs
The official docs for Kube MCP

### Tags
The kube-mcp to submodule should be locked to a commit in a release tag. The release tags for docs should be <kube-mcp-tag>d<docs-major/minor/bug verson>

### Release policy
CI runs on every push to `main` and on pull requests (build + typecheck only — no deploy).

Production deploys to [kubemcp.io](https://kubemcp.io) are triggered exclusively by pushing a version tag:

```bash
git tag v0.1.0d1
git push origin v0.1.0d1
```

Before tagging, ensure the `ext/kube-mcp` submodule is pinned to the corresponding upstream release commit.

### Logos
The master logo files are currently in 
