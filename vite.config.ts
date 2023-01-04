import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { NodeGlobalsPolyfillPlugin } from '@esbuild-plugins/node-globals-polyfill'
//import { NodeModulesPolyfillPlugin } from '@esbuild-plugins/node-modules-polyfill'
//import rollupPolyfillNode from 'rollup-plugin-polyfill-node'

export default defineConfig({
    resolve: {
        alias: {
            //assert: "assert/",
            buffer: "buffer/",
            crypto: "crypto-browserify",
            //event: "event/",
            path: "path-browserify",
            process: "process/browser",
            stream: "stream-browserify",
            util: "util/",
        },
    },

    optimizeDeps: {
        esbuildOptions: {
            define: {
                global: 'globalThis'
            },
            plugins: [
                //NodeModulesPolyfillPlugin(),
                NodeGlobalsPolyfillPlugin({
                    buffer: true,
                    process: true
                }),
                {
                    name: 'fix-node-globals-polyfill',
                    setup(build) {
                        build.onResolve(
                            { filter: /(_virtual-process-polyfill_|_buffer)\.js/ },
                            ({ path }) => ({ path })
                        )
                    }
                }
            ]
        }
    },

    /*build: {
        rollupOptions: {
            plugins: [
                rollupPolyfillNode({include: ['buffer']})
            ]
        }
    },*/

    plugins: [
        react()
    ]
})