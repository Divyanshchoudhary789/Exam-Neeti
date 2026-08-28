# Exam Neeti backend — Docker image.
#
# Only reason this exists instead of a plain Node buildpack: the rich
# bulk-upload pipeline needs LibreOffice (headless) on the server to
# rasterize legacy MathType/WMF/EMF equation images before sending them to
# Gemini — see backend/services/officeRasterizer.service.js. Render's
# managed Node runtime has no apt access, so this Dockerfile is what makes
# that dependency available there too (same idea applies to the VPS in
# production — just `apt install libreoffice` directly there instead).
#
# NOTE: the app still runs fine without LibreOffice present (equation
# rasterization fails gracefully — those specific equations get flagged for
# manual entry instead of crashing the whole upload, see
# bulkUploadOrchestrator.service.js), so this Dockerfile is what gets you
# the FULL automatic-conversion experience, not a hard requirement.

FROM node:20-bookworm-slim

# --no-install-recommends keeps this from pulling in LibreOffice's full
# desktop/GUI recommendation set (fonts galore, help browsers, etc.) — we
# only need the headless conversion filters, not a full office suite.
# libreoffice-writer covers the WMF/EMF/Draw import filters --convert-to
# needs; ca-certificates is required for outbound HTTPS (Cloudinary, Gemini,
# MongoDB Atlas) to work inside a slim image.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer \
    libreoffice-core \
    ca-certificates \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first (separate layer — only re-runs on lockfile change)
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV LIBREOFFICE_BIN=soffice

EXPOSE 8080

CMD ["node", "index.js"]
