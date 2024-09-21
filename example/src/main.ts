import axios from 'axios'
import './style.css'
import Tracker from '../../dist/index'

const tracker = new Tracker({
    url: {
        base: '1',
    },
    app: {
        name: 'exampleApp',
        version: '1.0.0',
    },
    debug: true,
    autoRecordXHR: true,
})
console.log(tracker)

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div>
    <div class="card">
      <button id="error" type="button">error</button>
      <button id="rejection" type="button">rejection</button>
      <button id="axios" type="button">axios</button>
    </div>
  </div>
`
const errorButton = document.getElementById('error')!
const rejectionButton = document.getElementById('rejection')!
const axiosButton = document.getElementById('axios')!
errorButton.addEventListener('click', () => {
    throw new Error('error')
})
rejectionButton.addEventListener('click', () => {
    Promise.reject(new Error('rejection'))
})
axiosButton.addEventListener('click', () => {
    axios.get('https://api.oioweb.cn/api/common/history').then((res) => {
        console.log(res)
    })
    axios.post('https://api.oioweb.cn/api/common/history#1', { hhaah: 'dakjhda' }).then((res) => {
        console.log(res)
    })
    // axios.put('https://api.oioweb.cn/api/common/history').then((res) => {
    //     console.log(res)
    // })
    // axios.delete('https://api.oioweb.cn/api/common/history').then((res) => {
    //     console.log(res)
    // })
    // axios.patch('https://api.oioweb.cn/api/common/history').then((res) => {
    //     console.log(res)
    // })
})
