-- Route photos: admin-uploaded trail photos mapped to GPS positions on segments
CREATE TABLE route_photos (
  id            BIGSERIAL PRIMARY KEY,
  route_id      INTEGER NOT NULL REFERENCES routes(id) ON DELETE CASCADE,
  segment_id    INTEGER REFERENCES segments(id) ON DELETE SET NULL,
  lat           DOUBLE PRECISION,
  lon           DOUBLE PRECISION,
  url           TEXT NOT NULL,
  description_en TEXT,
  description_ko TEXT,
  order_index   INTEGER DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX route_photos_route_id_idx ON route_photos(route_id);
