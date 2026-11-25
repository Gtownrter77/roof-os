#!/usr/bin/env node
import http from 'node:http'

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || !String(req.url).includes('/Messages.json')) {
    res.writeHead(404, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'not found' }))
    return
  }
  let body = ''
  req.on('data', (chunk) => { body += chunk })
  req.on('end', () => {
    const params = new URLSearchParams(body)
    if (!params.get('To') || !params.get('From') || !params.get('Body')) {
      res.writeHead(400, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'missing synthetic fields' }))
      return
    }
    res.writeHead(201, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ sid: 'SM000000000000000000000000000000ci', status: 'queued' }))
  })
})

server.listen(6060, '127.0.0.1', () => console.log('twilio-mock: listening on 127.0.0.1:6060'))
