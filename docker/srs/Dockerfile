FROM ossrs/srs:6
COPY srs.conf /usr/local/srs/conf/srs.conf
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:1985/api/v1/versions || exit 1
