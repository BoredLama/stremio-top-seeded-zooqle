const needle = require('needle')
const cheerio = require('cheerio')
const async = require('async')
const nameToImdb = require('name-to-imdb')

let domain = 'http://goxcors.appspot.com/cors?method=GET&url=https://zooqle.com/'

const imgDomain = 'https://zooqle.com'

let headers = '&header=User-Agent|' + encodeURIComponent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/71.0.3578.98 Safari/537.36')
headers += '&header=Origin|' + encodeURIComponent(imgDomain)
headers += '&header=Referer|' + encodeURIComponent(imgDomain + '/')

domain += domain + headers

let tops = {
  series: [],
  movie: []
}

let news = {
  series: [],
  movie: []
}

let newSe = {
  series: []
}

let updateMetasTimer

function getImdbs(items) {
console.log('get imdb')
  if (updateMetasTimer) {
    clearTimeout(updateMetasTimer)
    updateMetasTimer = false
  }

  const metas = []

  let countMetas = 0

  const metaQueue = async.queue((item, cb) => {
console.log('queue size: ' + metaQueue.length())
    if (item.imdb_id) {
      cb()
      return
    }

    let foundImdb

    function checkExistence(el, ij) {
      if (el.name == item.name && el.year == el.year) {
        if (el.imdb_id) {
          items[item.type][ij].imdb_id = res
          items[item.type][ij].id = res
          items[item.type][ij].poster = 'https://images.metahub.space/poster/small/'+res+'/img'
          foundImdb = true
          cb()
        }
        return true
      }
    }

    tops[item.type].some(checkExistence)
    news[item.type].some(checkExistence)
    if (newSe[item.type])
      newSe[item.type].some(checkExistence)

    if (!foundImdb) {
      nameToImdb(item, (err, res, inf) => { 
        if (!err && res) {
          items[item.type].some((el, ij) => {
            if (el.name == item.name && el.year == el.year) {
              items[item.type][ij].imdb_id = res
              items[item.type][ij].id = res
              items[item.type][ij].poster = 'https://images.metahub.space/poster/small/'+res+'/img'
              return true
            }
          })
          setTimeout(() => { cb() }, 10)
        } else {
          items[item.type].some((el, ij) => {
            if (el.name == item.name && el.year == el.year) {
              items[item.type][ij].tries++
              if (items[item.type][ij].tries < 3)
                metaQueue.push(item)
              return true
            }
          })
          cb()
        }
      })
    }

  }, 1)

  metaQueue.drain = () => {
    const newItems = { series: [], movie: [] }
    const newSeItems = { series: [] }
    const topItems = { series: [], movie: [] }

    let notFull

    for (var key in items)
      items[key].forEach((item, ij) => {
        if (item.imdb_id)
          (item.isNewSe ? newSeItems : item.isTop ? topItems : newItems)[key].push(item)
        else {
          items[key][ij].tries = 0
          notFull = true
        }
      })

    tops = topItems
    news = newItems
    newSe = newSeItems

    if (notFull) {
      updateMetasTimer = setTimeout(() => {
        getImdbs(items)
      }, 3600000) // try again in 1 hour
    }

    console.log('drained')
  }

  for (var key in items)
    items[key].forEach(item => { metaQueue.push(item) })
}



const populate = () => {
 
  const items = {
    'movie': [],
    'series': []
  }
console.log('needle start')
  needle.get(domain, (err, resp, body) => {
console.log('needle end')
    if (!err && body) {
      
      if (Buffer.isBuffer(body))
        body = body.toString()

console.log('needle end 1')
      const $ = cheerio.load(body)
      const panel = $('div.panel-heading.small')
console.log('needle end 2')
console.log(body)
      if (panel && panel.length) {
console.log('needle end 3')
        panel.each((ij, el) => {
console.log('needle end 4')
          const elem = $(el)
          let type

          if (elem.find('i').hasClass('zqf-tv'))
            type = 'series'
          else if (elem.find('i').hasClass('zqf-movies'))
            type = 'movie'

          if (type) {
            elem.parent().find('.panel-body').find('.tab-pane').each((ijp, pane) => {
              pane = $(pane)
              let isTop = pane.is('#movHot') || pane.is('#tvHot') ? true : false
              let isNewSe = pane.is('#tvNewSe') ? true : false
              $(pane).find('.cell').each((ijm, elm) => {
                const cell = $(elm)
                const name = cell.find('.txt-title').text()
                let poster
                let releaseInfo
                const imgTmp = cell.find('img')
                if (imgTmp && imgTmp.length)
                  poster = imgDomain + imgTmp.attr('src')
                if (poster && poster.includes('-2.')) 
                  poster = poster.replace('-2.', '-3.')
                if (type == 'movie') {
                  let tmp = cell.find('.text-muted3').eq(1).text()
                  if (tmp.includes(', ')) {
                    tmp = tmp.split(', ')[1]
                    if (isNaN(tmp) === false && tmp.length == 4)
                      releaseInfo = tmp
                  }
                }
                items[type].push({ name, poster, releaseInfo, year: releaseInfo, type, isTop, isNewSe, tries: 0 })
              })
            })
          }
        })
        getImdbs(items)
      }
    }
  })
}

populate()

setInterval(populate, 172800000) // populate every 2 days

const addonSDK = require('stremio-addon-sdk')

const addon = new addonSDK({
    id: 'org.topseededzooqle',
    version: '0.0.1',
    logo: 'https://www.saashub.com/images/app/service_logos/18/28ea71c28970/large.png',
    name: 'Top Seeded Movies & Series from Zooqle',
    description: 'Add-on to show a Catalog for Zooqle\'s Top Seeded Movies & Series',
    resources: ['catalog'],
    types: ['movie'],
    idPrefixes: ['tt'],
    catalogs: [
      {
        type: 'movie',
        id: 'topmovieszooqle',
        name: 'Top Seeded Movies by Zooqle',
        genres: ['New'],
        extraSupported: [ 'genre' ]
      },
      {
        type: 'series',
        id: 'topserieszooqle',
        name: 'Top Seeded Series by Zooqle',
        genres: ['New', 'New Season'],
        extraSupported: [ 'genre' ]
      }
    ]
})

addon.defineCatalogHandler((args, cb) => {
    cb(null, ['topmovieszooqle', 'topserieszooqle'].indexOf(args.id) > -1 ? { metas: (args.extra ? (args.extra.genre == 'New' ? news : args.extra.genre == 'New Season' ? newSe : tops) : tops)[args.type] } : null)
})

addon.runHTTPWithOptions({ port: process.env.PORT || 3000 })
