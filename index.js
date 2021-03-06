const needle = require('needle')
const cheerio = require('cheerio')
const async = require('async')
const nameToImdb = require('name-to-imdb')

let domain = 'http://goxcors.appspot.com/cors?method=GET&url=https://zooqle.com/'

const imgDomain = 'https://zooqle.com'

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

  if (updateMetasTimer) {
    clearTimeout(updateMetasTimer)
    updateMetasTimer = false
  }

  const metas = []

  let countMetas = 0

  const metaQueue = async.queue((item, cb) => {
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

  }

  for (var key in items)
    items[key].forEach(item => { metaQueue.push(item) })
}



const populate = () => {
 
  const items = {
    'movie': [],
    'series': []
  }

  needle.get(domain, (err, resp, body) => {

    if (!err && body) {
      
      if (Buffer.isBuffer(body))
        body = body.toString()

      const $ = cheerio.load(body)
      const panel = $('div.panel-heading.small')
      if (panel && panel.length) {
        panel.each((ij, el) => {
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

const { addonBuilder, serveHTTP, publishToCentral }  = require('stremio-addon-sdk')

const addon = new addonBuilder({
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
        extra: [
          {
            name: 'genre',
            isRequired: false
          }
        ]
      },
      {
        type: 'series',
        id: 'topserieszooqle',
        name: 'Top Seeded Series by Zooqle',
        genres: ['New', 'New Season'],
        extra: [
          {
            name: 'genre',
            isRequired: false
          }
        ]
      }
    ]
})

addon.defineCatalogHandler(args => {
  return new Promise((resolve, reject) => {
    resolve({ metas: (['topmovieszooqle', 'topserieszooqle'].indexOf(args.id) > -1 ? (args.extra ? (args.extra.genre == 'New' ? news : args.extra.genre == 'New Season' ? newSe : tops) : tops)[args.type] : []) })
  })
})

// cache for 2 days
serveHTTP(addon.getInterface(), { port: process.env.PORT || 3000, cache: 172800 })

publishToCentral("https://top-zooqle.herokuapp.com/manifest.json")
