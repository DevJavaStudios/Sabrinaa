const puppeteer = require('puppeteer')
const express = require('express')
const path = require('path')
const PORT = process.env.PORT || 5000
const app = express()
    .use(express.static(path.join(__dirname, 'public')))
    .set('views', path.join(__dirname, 'views'))
    .set('view engine', 'ejs')
    .get('/', (req, res) => res.render('index'))
    .get('/api/ssweb', async (req, res) => {
        try {
            let {
                url,
                full,
                delay
            } = {
                url: '',
                full: false,
                delay: 0,
                ...req.query
            }
            if (url) {
                const browser = await getBrowser()
                const page = await browser.newPage()
                await page.goto(url, {
                    waitUntil: 'load',
                    timeout: 300000
                })
                if (delay > 0) await sleep(delay)
                const screenshot = await page.screenshot({
                    type: 'png',
                    fullPage: full ? full != 'false' : false
                })
                await browser.close();
                res.writeHead(200, {
                    'Content-Type': 'image/png',
                    'Content-Length': screenshot.length
                });
                res.end(screenshot);
            } else {
                res.status(501).json({
                    error: 'parameter \'url\' not provided',
                    hint: '/api/ssweb?url=http://example.com',
                    status: 501
                })
            }
        } catch (e) {
            res.status(501).json({
                error: e,
                status: 501
            })
        }
    })
    .get('/api/canvas', async (req, res) => {
        try {
            let {
                code,
                apikey
            } = {
                code: '',
                ...req.query
            }
            if (process.env.API_KEY && process.env.API_KEY != apikey) return res.json({
                result: 'apikey invalid'
            })
            const browser = await getBrowser()
            const page = await browser.newPage()
            code = `try{\n${code}\n} catch (e) {}`
            const base64 = await page.evaluate(async function(code) {
                let c = document.createElement('canvas')
                let ctx = c.getContext('2d')
                await (new(async () => {}).constructor('c', 'ctx', 'Image', code))(c, ctx, Image)
                return c.toDataURL().split `,` [1]
            }, code)
            await browser.close();
            const image = Buffer.from(base64, 'base64')
            res.writeHead(200, {
                'Content-Type': 'image/png',
                'Content-Length': image.length
            })
            res.end(image)
        } catch (e) {
            res.status(501).json({
                error: e,
                status: 501
            })
        }
    })
    .get('*', function(req, res) {
        res.status(404).json({
            error: 'Page you are looking for is not found',
            hint: '/',
            status: 404
        })
    })
    .listen(PORT, () => console.log(`Listening on ${ PORT }`))
const io = require('socket.io')(app);

//listen on every connection
io.on('connection', (socket) => {
    socket.emit('memoryUsage', process.memoryUsage())
})

setInterval(io.emit, 2500, 'memoryUsage', process.memoryUsage())

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

async function getBrowser(opts = {}) {
    const chromeOptions = {
        headless: true,
        defaultViewport: {
            width: 1920,
            height: 1080
        },
        timeout: 120000,
        args: [
            "--incognito",
            "--no-sandbox",
            "--single-process",
            "--no-zygote",
            "--no-cache"
        ],
        ...opts
    }
    log('Launching Browser')
    return await puppeteer.launch(chromeOptions)
}

function log(...args) {
    console.log('\033[42mLOG\033[49m \033[33m%s\033[39m\n<', new Date(), ...args)
}
