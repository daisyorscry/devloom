# Security policy

Devloom starts commands and reads project directories on the machine where its server runs. Keep its dashboard/API and OTLP receiver on trusted local interfaces, and register only commands you intend to execute.

## Reporting a vulnerability

Use [GitHub's private vulnerability reporting](https://github.com/daisyorscry/devloom/security/advisories/new). Please do not publish exploitable details in a public issue or pull request.

Include the affected commit/version, operating system, native or Docker setup, a minimal reproduction, and the potential impact. Remove credentials and private application data from any attachments.

Devloom is in early development. Security fixes target the current `main` branch; older snapshots do not have a separate maintenance policy. Response and release timing depend on maintainer availability.
