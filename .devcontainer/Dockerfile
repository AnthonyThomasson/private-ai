FROM mcr.microsoft.com/devcontainers/typescript-node:1-22-bullseye

# Enable pnpm via corepack
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Install Docker CLI
RUN apt-get update && \
	apt-get install -y docker.io

# Install Claude CLI
RUN curl -fsSL https://claude.ai/install.sh | bash

RUN mkdir -p /workspaces/private-ai
WORKDIR /workspaces/private-ai