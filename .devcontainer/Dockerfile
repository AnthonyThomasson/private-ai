FROM mcr.microsoft.com/devcontainers/typescript-node:1-22-bullseye

# Install Docker CLI
RUN apt-get update && \
	apt-get install -y docker.io

# Install dotfiles (Cursor doesn't support dotfiles extension; mimics VS Code behaviour)
RUN git clone https://github.com/AnthonyThomasson/dotfiles.git /root/dotfiles && \
	(cd /root/dotfiles && sh install.sh)

# Install Claude CLI
RUN curl -fsSL https://claude.ai/install.sh | bash

RUN mkdir -p /workspaces/private-ai
WORKDIR /workspaces/private-ai