const getBuildNumber = async() => {
  return await fetch('api/build')
  .then((response) => {
    if (response.status === 200) {
      return response.text()
    } else {
      console.error(`Server error (${response.status})`)
      return false
    }
  })
  .catch((error) => {
    console.error(error)
    return false
  })
}

const init2 = async() => {
  document.querySelector('#buildId').innerText = `SB: ${await getBuildNumber()}`
}

document.addEventListener('DOMContentLoaded', function() {
  init2()
})