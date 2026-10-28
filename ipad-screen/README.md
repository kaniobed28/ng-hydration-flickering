# iPad second screen

Use an iPad as an extended monitor for a Windows PC on the same Wi-Fi. Windows gets a second (virtual) screen, and the iPad shows it. Drag windows onto it like any other monitor.

You don't need to run `npm install`, sign up for anything, or be online after setup. You only need [Node.js](https://nodejs.org).

## Setup (once)

Double-click **`setup.cmd`** and accept the administrator prompt. It:

1. Downloads and installs the open-source, signed [Virtual Display Driver](https://github.com/VirtualDrivers/Virtual-Display-Driver), pinned to release 25.7.23 and checked against a SHA-256 hash. The driver comes preset with iPad resolutions.
2. Switches Windows to **Extend these displays**.
3. Lets the iPad through Windows Firewall on port 8080 (private networks only).
4. If your Wi-Fi is set to Public, asks before switching it to Private, because the iPad can't connect over a Public network.

Optional: in Settings → System → Display, click the new screen and pick your iPad's resolution, for example 2360×1640 for an iPad Air, or 1180×820 for bigger text and smoother video.

## Use

1. Double-click **`start.cmd`**. It starts the server and opens the PC page in Edge.
2. On the PC page, click **Send extra screen to iPad** and pick the virtual display (usually "Screen 2", not your main screen).
3. On the iPad, open the `http://192.168…:8080` address shown in the window in Safari and tap **Connect**. Tap the video to make it full screen.

To run it without the shortcut: `node server.js`. To use another port: `set PORT=9000` before starting, and run `setup.cmd -Port 9000` once.

## Uninstall

Run `setup.cmd -Uninstall` from a terminal in this folder. It removes the virtual display, its driver, and the firewall rule.

## Troubleshooting

- **Several iPad addresses are printed:** VPN or VirtualBox adapters add extra ones. Use the one on the same network as the iPad. That's usually `192.168.x.x` and matches your Wi-Fi adapter's IPv4 address in `ipconfig`.
- **The iPad can't load the page:** both devices must be on the same Wi-Fi, and that network must be Private (run `setup.cmd` again to check).
- **No "Screen 2" in the picker:** restart the PC once after setup, then check Settings → System → Display.
- **Touch input:** the iPad only displays the screen; touches don't control the PC. If you need touch, [spacedesk](https://www.spacedesk.net/) is free and also works over the local network.
