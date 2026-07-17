# One Team, One Fight

A dependency-free browser arcade prototype for the RIP-89 mini cabinet campaign.

## Run Locally

Open `index.html` in a browser, or serve this folder:

```bash
python3 -m http.server 8080
```

Then visit `http://127.0.0.1:8080`.

## Controls

- Start: `Enter`, `1`, or `Numpad Enter`
- Move: `Left/Right`, `A/D`, or numpad `4/6`
- Fire: hold `Space`, `Z`, `X`, or arcade button mapped to `Ctrl`

## Cabinet Notes

- Canvas resolution is `480x320`, built for a 3:2 small display and scaled with pixelated rendering.
- No external assets or dependencies are required, which keeps Raspberry Pi kiosk deployment simple.
- For a Raspberry Pi 4, launch Chromium in kiosk mode pointed at the local file or localhost server.
- Arcade controls can be mapped through a USB encoder as keyboard inputs using the bindings above.

## Included Personalization

- Intro flow: `ONE TEAM, ONE FIGHT` title screen followed by a J.C. Herrera quote screen
- Player: red CrowdStrike-inspired Falcon silhouette with a more logo-like pixel treatment
- Enemies: `Scattered Spider`, `Fancy Bear`, and `Cozy Bear` rows
- Enemy fire: binary `1` and `0` breach shots
- Win state: `ADVERSARY STOPPED`
- Loss state: `BREACH DETECTED`
- Easter egg: `HERRERAJC`
