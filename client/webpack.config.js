import url, { URL } from "node:url";
import BrowserSyncPlugin from "browser-sync-webpack-plugin";
import TerserPlugin from "terser-webpack-plugin";

const path = url.fileURLToPath(new URL("public/", import.meta.url));

const mode = process.env.NODE_ENV ?? "development";

export default {
  mode,

  entry: { bundle: "./src/init.ts" },

  resolve: { extensions: [".ts", ".js"] },

  // `path` is the directory the page is served from, so the URL webpack works
  // out for the game worker (the public path is detected at runtime) matches
  // where it is really served. Each entry gets its own file: the bundle and the
  // worker.
  output: { path, publicPath: "auto", filename: "[name].js" },

  optimization: {
    // Keep each entry self-contained: the page loads one script and the worker
    // is a single file, with no shared vendors chunk.
    splitChunks: false,
    ...(mode !== "development" && {
      minimize: true,
      minimizer: [new TerserPlugin({ terserOptions: { mangle: true } })],
    }),
  },

  ...(mode === "development" && { devtool: "eval-source-map" }),

  module: {
    rules: [
      {
        test: /\.(ts|js)/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env", "@babel/preset-typescript"],
          },
        },
      },
    ],
  },

  plugins: [
    new BrowserSyncPlugin({
      host: "localhost",
      port: 3000,
      server: { baseDir: "public" },
      files: ["worker/**/*.ts", "../*/src/**/*.ts"],
    }),
  ],
};
