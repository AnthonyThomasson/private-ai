FROM mcr.microsoft.com/devcontainers/typescript-node:1-22-bullseye

# Install Docker CLI
RUN apt-get update && \
	apt-get install -y docker.io

RUN mkdir -p /workspaces/private-ai
WORKDIR /workspaces/private-ai