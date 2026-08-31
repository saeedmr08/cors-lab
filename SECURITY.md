# Security Policy

## What this project is

**CORS Lab** is an educational, client-side simulator. It models how browsers evaluate Cross-Origin Resource Sharing (CORS) responses for teaching and portfolio demonstration. All origins, headers, and outcomes are synthetic.

## What this project is not

- Not a CORS bypass tool
- Not a proxy, tunnel, or request-smuggling aid
- Not a vulnerability scanner against live targets
- Not intended to defeat browser security, same-origin policy, or site protections

Do not use this project to attempt unauthorized access to third-party APIs or to circumvent security controls.

## Reporting issues

If you find a documentation mistake or a logic bug in the simulator’s CORS decision rules, open an issue or contact the author. Please do not submit “weaponization” requests or ask for features that would turn this into an attack utility.

## Safe use

- Run locally for learning (`npm run dev`)
- Treat all scenario data as fictional
- Prefer official specs ([Fetch Living Standard](https://fetch.spec.whatwg.org/#http-cors-protocol), MDN CORS) as the source of truth when building production APIs
