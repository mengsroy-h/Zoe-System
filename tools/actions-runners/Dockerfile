FROM node:24-bookworm-slim AS node
FROM ubuntu:24.04
ARG DEBIAN_FRONTEND=noninteractive
ARG RUNNER_VERSION=2.337.0
ARG RUNNER_SHA256=70920811a4f8ad4328818682bca5c6469c1c942fab52448868071d0063816613
ARG PLAYWRIGHT_VERSION=1.63.0
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
 && ln -s /usr/local/lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
 && apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl git gh jq unzip xz-utils sudo python3 util-linux libstdc++6 libreadline8t64 libzstd1 liblz4-1 libxml2 \
 && useradd --create-home --uid 1001 --shell /bin/bash runner \
 && mkdir -p /home/runner/actions-runner /opt/pw-browsers/chromium-1194 \
 && curl -fL --retry 3 "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz" -o /tmp/runner.tar.gz \
 && echo "${RUNNER_SHA256}  /tmp/runner.tar.gz" | sha256sum -c - \
 && tar -xzf /tmp/runner.tar.gz -C /home/runner/actions-runner \
 && /home/runner/actions-runner/bin/installdependencies.sh \
 && npx --yes "playwright@${PLAYWRIGHT_VERSION}" install-deps chromium \
 && chown -R runner:runner /home/runner /opt/pw-browsers \
 && rm -f /tmp/runner.tar.gz \
 && rm -rf /var/lib/apt/lists/* /root/.npm
RUN apt-get update \
 && apt-get install -y --no-install-recommends openjdk-21-jdk-headless \
 && node --version \
 && java -version \
 && javac -version \
 && rm -rf /var/lib/apt/lists/*
ENV HOME=/home/runner
ENV LANG=C.UTF-8
RUN mkdir -p /opt/zoe-cache && chown runner:runner /opt/zoe-cache
ENV ZOE_AUDIT_CACHE=/opt/zoe-cache
USER runner
WORKDIR /home/runner/actions-runner
CMD ["./run.sh"]
