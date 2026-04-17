const NextResponse = {
  json: (data, init) => ({ data, init }),
  redirect: (url) => ({ redirect: url }),
}

module.exports = { NextResponse }
