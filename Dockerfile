FROM ghcr.io/muchobien/pocketbase:latest

# Copy your hooks and migrations
COPY ./_data/pb/hooks /pb_hooks

EXPOSE 8090

# Important: Bind to 0.0.0.0 for Railway
CMD ["/usr/local/bin/pocketbase", "serve", "--http=0.0.0.0:8090"]
