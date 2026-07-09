# もじへんしんランド 🔤✨

Metamorphabet風のインタラクティブABCゲームです。
A・B・C・D・E の5文字を「つつく」「引っぱる」「回す」と、ぷにぷにの弾力アニメーションで
いきものや たべものに変身します。英語が好きな4歳児向けです。

## あそびかた

1. すきな文字をタップしてえらぶ
2. 👆 **つつく**(3回)…… 文字がぷにぷにゆれて、へんしん!
3. ✋ **引っぱる**(ぐーんと2回)…… ボヨンボヨン! もういちど へんしん!
4. 🔄 **回す**(くるくる)…… 文字にもどって 🌟 できた!

ゆびのアイコンがヒントとして表示されるので、文字が読めなくても遊べます。

## へんしんする ことば

| 文字 | へんしん1 | へんしん2 |
| :-: | :-: | :-: |
| A | 🍎 Apple | 🐜 Ant |
| B | 🐦 Bird | 🎈 Balloon |
| C | 🐱 Cat | ☁️ Cloud |
| D | 🐶 Dog | 🦆 Duck |
| E | 🐘 Elephant | 🥚 Egg |

## 動かしかた

ビルド不要です。フォルダごと静的Webサーバーに置いて `index.html` を開くだけで動きます。

```bash
cd moji-henshin-land
python3 -m http.server 8000
# → ブラウザで http://localhost:8000 を開く
```

- 対象: iPhone / iPad の Safari(縦画面・横画面どちらも対応)
- ネット接続不要(Three.js は `vendor/` に同梱、効果音は WebAudio で合成)
- 進捗(できた文字の⭐)は端末内の localStorage に保存されます

## 構成

```
moji-henshin-land/
├── index.html        画面・UI・スタイル
├── src/
│   ├── main.js       ゲーム進行・入力・ばね物理・カメラ
│   ├── letters.js    A〜E の立体文字(フォント不要のShape押し出し)
│   ├── creatures.js  変身先のキャラクター(プリミティブ組み合わせ)
│   ├── fx.js         キラキラ・紙ふぶきエフェクト
│   └── audio.js      WebAudio合成の効果音(ぽよん・ボヨン・ファンファーレ)
└── vendor/
    └── three.module.min.js   Three.js r170
```
