import path from "path";

export default {
  target: "node",
  mode: "development",
  // 모드 production시 (default) devtool: "source-map",
  //devtool: false,
  entry: path.resolve("src/app.ts"),
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: "ts-loader",
        exclude: /node_modules/,
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  output: {
    filename: "app.js",
    path: path.resolve("./"),
  },
};
