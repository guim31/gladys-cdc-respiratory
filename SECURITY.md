# Security policy

## Reporting a vulnerability

Please do **not** report a security problem in a public issue, pull request or
forum post.

Report it privately through GitHub instead: open the **Security** tab of this
repository, then **Report a vulnerability**.

No such button? Private reporting is not enabled yet: open an issue that only
asks the maintainers for a private contact, without any detail of the problem,
and send the report there.

Include, when you can:

- the version of the integration and of Gladys;
- what an attacker can do, and the steps to reproduce it;
- the log lines that help (remove tokens, passwords and addresses first).

The fix ships as a new version of the integration, and the advisory is
published once users can update.

## Supported versions

Only the latest release receives security fixes: update the integration from
Gladys before reporting a problem.

## Scope

In scope: the code of this repository and the Docker image it publishes.

What the integration handles:

- `/data/cdc-respiratory.json`: the rows last read from data.cdc.gov (public, aggregated data:
  weekly levels per treatment plant and per state), the time of the last read, a rate-limit
  pause, and the last week and level seen per place, virus and indicator. No personal data.
- One optional secret: the data.cdc.gov application token, stored by Gladys in the integration
  configuration, sent only in the `X-App-Token` header to data.cdc.gov, never logged nor written
  under `/data`.
- Network: outgoing HTTPS only, to `data.cdc.gov`. The container listens on no port.

Out of scope: Gladys Assistant itself (see its
[security policy](https://github.com/GladysAssistant/Gladys/security/policy)),
and the third-party services the integration talks to.
