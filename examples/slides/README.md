# Example slides

Load these into the editor (demo page → _Load JSON_) or render them on a server:

```js
const { registerFont, renderPNG } = require("slide-editor/node");
registerFont("ArchivoBlack-Regular.ttf", { family: "Archivo Black" });
fs.writeFileSync(
  "slide.png",
  await renderPNG(fs.readFileSync("be-right-back.json", "utf8")),
);
```

| File                    | Size      | Notes                                                     |
| ----------------------- | --------- | --------------------------------------------------------- |
| `were-coming-back.json` | 1920×1080 | gradient light streaks, text with a tilted letter         |
| `be-right-back.json`    | 1920×1080 | starfield, blob bands, emoji illustrations, outlined text |

Both use the free font [Archivo Black](https://fonts.google.com/specimen/Archivo+Black) (SIL Open Font License), which is not included: load it in the browser (`fonts: [{ name: 'Archivo Black', google: 'Archivo Black' }]`) and register its TTF file on a server.

## Credits

`be-right-back.json` contains emoji artwork from [Fluent Emoji](https://github.com/microsoft/fluentui-emoji) by Microsoft Corporation (comet, ringed planet, satellite, astronauts, waving hands), used under the MIT License:

> MIT License
>
> Copyright (c) Microsoft Corporation.
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
