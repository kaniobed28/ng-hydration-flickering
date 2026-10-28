# iPad second screen

Use an iPad as an extra monitor for a Windows PC on the same Wi-Fi. `server.js` is the whole app. You don't need to run `npm install` or have an internet connection.

## One-time setup

Install a virtual display driver (for example the open-source [Virtual Display Driver](https://github.com/VirtualDrivers/Virtual-Display-Driver)). Then in Windows display settings, set it to **Extend these displays**. Without it, Windows has no second screen to extend onto.

## Use

1. On the PC, run `node server.js`. It prints a PC address and an iPad address.
2. On the PC, open `http://localhost:8080` in Chrome or Edge, click **Send extra screen to iPad**, and pick the virtual display (usually "Screen 2", not your main screen). The iPad then becomes an extended desktop: drag windows onto it like any second monitor.
3. On the iPad, open the printed `http://192.168…:8080` address in Safari and tap **Connect**. Tap the video to make it full screen.

To use a different port, set `PORT` (for example `PORT=9000 node server.js`).

## Troubleshooting

- If several iPad addresses are printed (VPN or VirtualBox adapters add extra ones), use the one on the same network as the iPad. That's usually `192.168.x.x` and matches your Wi-Fi adapter's IPv4 address in `ipconfig`.
- If the iPad can't load the page, allow Node through Windows Firewall when it asks, and set the Wi-Fi network to **Private**.
- The iPad shows the screen but doesn't send touch input back to the PC. If you need touch, [spacedesk](https://www.spacedesk.net/) is free and also works over the local network.
