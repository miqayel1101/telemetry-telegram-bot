# Memory

- fuel-tracking: New `src/fuel/` module with inline anomaly detection (theft/refuel) via Redis-cached previous fuel level, fleet fuel config, and REST analytics endpoints — chosen over cron-based detection for real-time alerting with minimal complexity.
