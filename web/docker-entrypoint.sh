#!/bin/sh
set -e

# Executed automatically by the official nginx image entrypoint through /docker-entrypoint.d/*.sh before nginx starts.
# Generate runtime config.js from environment variables. Each analytics provider has an independent variable;
# unset providers remain disabled, load no scripts, and send no external requests. Multiple providers may be enabled together.

# GA4 and Baidu IDs contain only letters, numbers, and hyphens. Remove other characters
# so quotes and similar values cannot break the JavaScript strings in config.js as a defense-in-depth measure.
sanitize_id() {
    printf '%s' "$1" | tr -cd 'A-Za-z0-9-'
}

# Allow only characters safe inside a JSON string to avoid breaking config.js.
sanitize_url() {
    printf '%s' "$1" | tr -cd 'A-Za-z0-9:/._-#'
}

# Model names / channel name: letters, digits, dot, hyphen, underscore only.
sanitize_model() {
    printf '%s' "$1" | tr -cd 'A-Za-z0-9._-'
}

GA4_ID=$(sanitize_id "${ANALYTICS_GA4_ID:-}")
BAIDU_ID=$(sanitize_id "${ANALYTICS_BAIDU_ID:-}")
SITE_URL=$(sanitize_url "${SITE_URL:-}")

# Agnes 系统默认渠道：API Key 含 sk- 前缀字母数字，baseUrl 走 URL 字符集，
# 模型名/渠道名仅允许字母数字与点横下划线。任一关键值未设置则对应项留空，
# 前端 runtime-config.ts 检测不到即不启用系统渠道（回退用户自配）。
AGNES_KEY=$(sanitize_id "${AGNES_API_KEY:-}")
AGNES_BASE=$(sanitize_url "${AGNES_BASE_URL:-}")
AGNES_IMAGE=$(sanitize_model "${AGNES_IMAGE_MODEL:-}")
AGNES_VIDEO=$(sanitize_model "${AGNES_VIDEO_MODEL:-}")
AGNES_TEXT=$(sanitize_model "${AGNES_TEXT_MODEL:-}")
AGNES_NAME=$(sanitize_model "${AGNES_CHANNEL_NAME:-}")

cat > /usr/share/nginx/html/config.js <<EOF
window.__RUNTIME_CONFIG__ = {
  ANALYTICS_GA4_ID: "${GA4_ID}",
  ANALYTICS_BAIDU_ID: "${BAIDU_ID}",
  SITE_URL: "${SITE_URL}",
  AGNES_API_KEY: "${AGNES_KEY}",
  AGNES_BASE_URL: "${AGNES_BASE}",
  AGNES_IMAGE_MODEL: "${AGNES_IMAGE}",
  AGNES_VIDEO_MODEL: "${AGNES_VIDEO}",
  AGNES_TEXT_MODEL: "${AGNES_TEXT}",
  AGNES_CHANNEL_NAME: "${AGNES_NAME}"
};
EOF
