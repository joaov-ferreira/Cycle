# Android APK build image for CYCLE (SPEC §12.4, docs/DECISIONS.md "CI and APK pipeline").
# Toolchain for Expo SDK 58 / React Native 0.88: JDK 17, Node 22, Android SDK platform 37,
# build-tools 37.0.0, NDK 27.1.12297006, CMake 3.30.5. No secrets are baked in; signing
# material is passed at run time (see scripts/build-apk.sh).
#
#   docker build -t cycle-android docker/android
#   docker run --rm --user "$(id -u):$(id -g)" -v "$PWD":/app cycle-android
FROM eclipse-temurin:17.0.19_10-jdk-jammy

ARG NODE_VERSION=22.23.4
ARG NODE_SHA256=1805bcd35e6815559bd2eb97db438d3fdb0eb3a5e6a977b7c1badca76337e9ce
ARG CMDLINE_TOOLS_VERSION=16111833
ARG CMDLINE_TOOLS_SHA1=e025545c62a8e64c7559119566a569fb1dec5f60
ARG ANDROID_PLATFORM=android-37.0
ARG ANDROID_BUILD_TOOLS=37.0.0
ARG ANDROID_NDK=27.1.12297006
ARG ANDROID_CMAKE=3.30.5

ENV DEBIAN_FRONTEND=noninteractive \
    ANDROID_HOME=/opt/android-sdk \
    ANDROID_SDK_ROOT=/opt/android-sdk \
    HOME=/home/builder \
    GRADLE_USER_HOME=/home/builder/.gradle \
    npm_config_cache=/home/builder/.npm \
    CI=true
ENV PATH="${ANDROID_HOME}/cmdline-tools/latest/bin:${ANDROID_HOME}/platform-tools:${PATH}"

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl git unzip xz-utils python3 \
    && rm -rf /var/lib/apt/lists/*

# Node.js from the official tarball, checksum verified.
RUN curl -fsSL -o /tmp/node.tar.xz "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-x64.tar.xz" \
    && echo "${NODE_SHA256}  /tmp/node.tar.xz" | sha256sum -c - \
    && tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 \
    && rm /tmp/node.tar.xz \
    && node --version && npm --version

# Android command-line tools (checksum verified), then SDK packages with licenses accepted.
RUN mkdir -p "${ANDROID_HOME}/cmdline-tools" \
    && curl -fsSL -o /tmp/cmdline-tools.zip "https://dl.google.com/android/repository/commandlinetools-linux-${CMDLINE_TOOLS_VERSION}_latest.zip" \
    && echo "${CMDLINE_TOOLS_SHA1}  /tmp/cmdline-tools.zip" | sha1sum -c - \
    && unzip -q /tmp/cmdline-tools.zip -d "${ANDROID_HOME}/cmdline-tools" \
    && mv "${ANDROID_HOME}/cmdline-tools/cmdline-tools" "${ANDROID_HOME}/cmdline-tools/latest" \
    && rm /tmp/cmdline-tools.zip \
    && yes | sdkmanager --licenses > /dev/null \
    && sdkmanager "platform-tools" "platforms;${ANDROID_PLATFORM}" "build-tools;${ANDROID_BUILD_TOOLS}" \
        "ndk;${ANDROID_NDK}" "cmake;${ANDROID_CMAKE}" \
    && rm -rf "${ANDROID_HOME}/.temp"

# Non-root user. The SDK and the home directory are world-writable so the container also works
# with `--user $(id -u):$(id -g)` (needed for a bind-mounted workspace owned by the host user).
RUN useradd --create-home --uid 1000 --shell /bin/bash builder \
    && mkdir -p /home/builder/.gradle /home/builder/.npm /app \
    && chmod -R a+rwX "${ANDROID_HOME}" /home/builder /app

USER builder
WORKDIR /app
# The build script comes from the mounted workspace, so the image never goes stale.
ENTRYPOINT ["bash", "/app/scripts/build-apk.sh"]
