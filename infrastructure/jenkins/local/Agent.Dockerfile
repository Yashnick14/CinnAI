FROM hashicorp/terraform:1.13.4 AS terraform
FROM docker:28.5.2-cli AS docker
FROM mcr.microsoft.com/powershell:7.4-debian-12 AS powershell
FROM jenkins/inbound-agent:jdk21 AS remoting
FROM eclipse-temurin:21-jdk-jammy AS java
FROM node:22-bookworm-slim
USER root
COPY --from=java /opt/java/openjdk /opt/java/openjdk
COPY --from=remoting /usr/share/jenkins/agent.jar /usr/share/jenkins/agent.jar
ENV JAVA_HOME=/opt/java/openjdk
ENV PATH="/opt/java/openjdk/bin:${PATH}"
RUN usermod -l jenkins -d /home/jenkins node && groupmod -n jenkins node
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl gnupg git unzip libicu72 libssl3 libgssapi-krb5-2 && rm -rf /var/lib/apt/lists/*
COPY --from=terraform /bin/terraform /usr/local/bin/terraform
COPY --from=docker /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker /usr/local/libexec/docker/cli-plugins/ /usr/local/libexec/docker/cli-plugins/
COPY --from=powershell /opt/microsoft/powershell /opt/microsoft/powershell
RUN ln -s /opt/microsoft/powershell/7/pwsh /usr/local/bin/pwsh
RUN curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft.gpg && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft.gpg] https://packages.microsoft.com/repos/azure-cli/ bookworm main" > /etc/apt/sources.list.d/azure-cli.list && apt-get update && apt-get install -y --no-install-recommends azure-cli && rm -rf /var/lib/apt/lists/*
ENV AZURE_EXTENSION_DIR=/opt/azure-extensions
RUN az extension add --name containerapp && mkdir -p /home/jenkins/agent/release && chown -R jenkins:jenkins /home/jenkins
USER jenkins
WORKDIR /home/jenkins/agent
