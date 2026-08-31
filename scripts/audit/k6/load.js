import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 20 },
    { duration: "1m", target: 20 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800"],
  },
};

const BASE = __ENV.BASE_URL;

export default function () {
  const res = http.get(`${BASE}/`);
  check(res, { "status is 2xx/3xx": (r) => r.status < 400 });
  sleep(1);
}
