// BOTTENDER
const { router, line } = require('bottender/router');

// AXIOS API
const axios = require('axios');

// POSTGRESQL
const { Pool } = require('pg');
const credentials = {
    host: process.env.POSTGRESQL_HOST,
    database: process.env.POSTGRESQL_DATABASE,
    user: process.env.POSTGRESQL_USERNAME,
    password: process.env.POSTGRESQL_PASSWORD,
    port: process.env.POSTGRESQL_PORT,
    ssl: { rejectUnauthorized: false }
};

// LINE API HEADER
const headerLine = {
    'Content-Type': 'application/json; charset=UTF-8',
    'Authorization': 'Bearer ' + process.env.LINE_ACCESS_TOKEN
}

// ZOOM API HEADER
async function getHeaderZoom() {
    const pool = new Pool(credentials);
    const requestToken = async () => {
        return await pool.query("SELECT zoom_token FROM data WHERE id = 1");
    }
    const ambilToken = await requestToken();
    const token = ambilToken.rows[0].zoom_token;

    return {
        "Content-Type": "application/json; charset=UTF-8",
        "Authorization": "Bearer " + token
    }
}

/* ================================================ */
// BOT APP
module.exports = function App(){
    return router([
        line.message(HandleMessage)
    ]);
};

function HandleMessage(context){
    if(context.event.isText){
        const userMsg = context.event.text;

        if(userMsg === '/zoom'){
            return getMyMeetings(context);
        }
        else if(userMsg === '/live'){
            return zoomOnProgress(context);
        }
        else if(userMsg.substring(0,5) === '/book'){
            return scheduleZoom(context);
        }
        else if(userMsg.substring(0,6) === '/start'){
            return startZoom(context);
        }
        else if(userMsg.substring(0,5) === '/info'){
            return getZoomInvite(context);
        }
        else if(userMsg === '/help'){
            return getHelp(context);
        }
        else if(userMsg.substring(0,7) === '/delete'){
            return deleteZoom(context);
        }
        else if(userMsg === '/leave'){
            return leaveLine(context);
        }
        else if(userMsg.substring(0,1) === "/"){
            return context.sendText("Kode tersebut belum tersedia.");
        }
    }
}

function getHelp(context) {
    let opening =
        "*SELAMAT DATANG DI HENDRY BOT 👋*\n" +
        "*Berikut adalah fitur Bot yang tersedia saat ini:*\n\n";

    let fitur =
        "*1. List Booking Zoom Meeting:*\n" +
        "Ketik /zoom\n\n" +
        "*2. Booking Zoom Meeting:*\n" +
        "Ketik /book diikuti dengan topik rapat, tanggal rapat (YYYY-MM-DD), waktu rapat (HH:mm), durasi rapat (dalam menit), dan passcode (maksimal 10 karakter, boleh pake huruf). Setiap variabel dipisah menggunakan tanda koma berspasi ( , ).\nContoh: /book Rapat Bionix , 2021-08-31 , 19:00 , 60 , Satu234\n\n" +
        "*3. Start Zoom Meeting:*\n" +
        "Ketik /start spasi Meeting ID.\nContoh: /start 8275960095\n\n" +
        "*4. Cancel Zoom Meeting:*\n" +
        "Ketik /delete spasi Meeting ID.\nContoh: /delete 8275960095\n\n" +
        "*5. Invitation Zoom Meeting:*\n" +
        "Ketik /info spasi Meeting ID.\nContoh: /info 8275960095\n\n" +
        "*6. Zoom Meeting on progress:*\n" +
        "Ketik /live";

    let ending =
        "Jika kamu memiliki kritik, saran, atau ide untuk pengembangan Bot ini, hubungi Hendry melalui: \nLine: https://line.me/ti/p/~hendry.naufal \nWhatsApp: https://wa.me/6285155034580";

    let msg = opening + fitur + ending;
    context.sendText(msg);
}

async function getLineName(context) {
    const userID = context._event._rawEvent.source.userId;

    const request = async () => {
        const respon = await axios.get("https://api.line.me/v2/bot/profile/" + userID, {headers: headerLine});
        return respon.data;
    }
    const data = await request();
    return data.displayName;
}

function leaveLine(context) {
    const groupID = context._event._rawEvent.source.groupId || undefined;
    const roomID = context._event._rawEvent.source.roomId || undefined;
    context.sendText("Terima kasih telah menggunakan HNM BOT. Sampai jumpa 👋");

    if(roomID === undefined) {
        axios.post("https://api.line.me/v2/bot/group/" + groupID + "/leave", [], {headers: headerLine});
    }
    else if(groupID === undefined) {
        axios.post("https://api.line.me/v2/bot/room/" + roomID + "/leave", [], {headers: headerLine});
    }
}

async function updateToken(){
    const pool = new Pool(credentials);
    const requestData = async() => {
        return await pool.query("SELECT * FROM data WHERE id = 1");
    }
    const result = await requestData();
    const now = new Date().getTime();

    const time = result.rows[0].zoom_time_token;
    let last = Number(time) + 3600000;

    if(last <= now){
        const client = process.env.ZOOM_CLIENT_ID;
        const secret = process.env.ZOOM_CLIENT_SECRET;
        const keyLocked = Buffer.from(client + ":" + secret).toString('base64');
        let headerBasic = {
            'Content-Type': 'application/json; charset=UTF-8',
            'Authorization': 'Basic ' + keyLocked
        }
        const oldRefToken = result.rows[0].zoom_refresh_token;

        const request = async () => {
            const respon = await axios.post("https://zoom.us/oauth/token?grant_type=refresh_token&refresh_token=" + oldRefToken, {}, { headers: headerBasic });
            return respon.data;
        }
        const data = await request();

        const acc_token = String(data.access_token);
        const ref_token = String(data.refresh_token);
        const now_token = String(new Date().getTime());

        const request1 = async() => {
            return await pool.query(`UPDATE data SET zoom_token = ${acc_token}, zoom_refresh_token = ${ref_token}, zoom_time_token = ${now_token} WHERE id = 1`);
        }
        await request1();
    }
    await pool.end();
}

async function scheduleZoom(context){
    let setting = context.event.text.substring(6).split(" , ");

    let msg;
    let topic = setting[0];
    let date = setting[1];
    let time = setting[2];
    let duration = setting[3];
    let passcode = setting[4];
    let pembuat = await getLineName(context);

    if(
        passcode === undefined ||
        date.substring(4,5) !== "-" ||
        date.substring(7,8) !== "-" ||
        time.substring(2,3) !== ":" ||
        /[a-zA-Z]/g.test(duration) ||
        duration > 600 ||
        passcode.length > 10
    ){
        msg = "Format keyword salah ⛔, silakan gunakan /help untuk melihat format keyword yang benar 😉";
    }
    else{
        await updateToken();
        let time1 = date + "T" + time + ":00";

        let payload = {
            "topic": topic,
            "agenda": pembuat,
            "type": 2,
            "start_time": time1,
            "timezone": "Asia/Jakarta",
            "duration": duration,
            "password": passcode,
            "settings": {
                "host_video": false,
                "participant_video": false,
                "mute_upon_entry": true,
                "audio": "voip",
                "waiting_room": true,
            }
        }

        const request = async () => {
            const respon = await axios.post("https://api.zoom.us/v2/users/me/meetings", payload, { headers: await getHeaderZoom() });
            return respon.data;
        }
        const data = await request();

        let newTopic = data.topic;
        let id = data.id;
        let meetID = id.toString();
        let desc = data.agenda;
        let newDate = new Date(data.start_time).toLocaleString('id-ID',{dateStyle: 'full'});
        let newStart = new Date(data.start_time).toLocaleString('id-ID',{timeStyle: 'short'});
        let newDuration = data.duration;
        let newEnd = new Date((new Date(data.start_time).getTime()) + (newDuration * 60000)).toLocaleString('id-ID',{timeStyle: 'short'});
        let newURL = data.join_url;

        msg =
            desc + " mengajak Anda untuk bergabung ke Zoom Meeting.\n\n" +
            "*Topik: " + newTopic + "*\n" +
            "Tanggal: " + newDate + "\n" +
            "Waktu: " + newStart + " - " + newEnd + " (" + duration + " menit)\n\n" +
            "Join Zoom Meeting\n" + newURL.replace("telkomsel.","") + "\n\n" +
            "Meeting ID: " + meetID.substring(0,3) + " " + meetID.substring(3,7) + " " + meetID.substring(7) + "\n" +
            "Passcode: " + passcode + "\n";
    }

    await context.sendText(msg);
}

async function getMyMeetings(context) {
    await updateToken();
    const request = async () => {
        const respon = await axios.get("https://api.zoom.us/v2/users/me/meetings?type=upcoming", { headers: await getHeaderZoom() });
        return respon.data;
    }
    const hasil = await request();
    const data = hasil.meetings;
    let konten = [];
    let count = 0;

    for(let i = 0; i < data.length; ++i) {
        let id = data[i].id;
        let topic = data[i].topic;
        let date = new Date(data[i].start_time).toLocaleString('id-ID', {dateStyle: 'full'});
        let duration = data[i].duration;
        let pembuat = data[i].agenda;
        let type = data[i].type;
        let timeStart = new Date(data[i].start_time).toLocaleString('id-ID', {timeStyle: 'short'});
        let timeEnd = new Date((new Date(data[i].start_time).getTime()) + (duration * 60000)).toLocaleString('id-ID', {timeStyle: 'short'});

        if (id === '' || id === null) {
            break;
        } else {
            if (type === 2) {
                konten.push(
                    {
                        "type": "box",
                        "layout": "vertical",
                        "contents": [{
                            "type": "text",
                            "text": "Topik: " + topic,
                            "size": "sm",
                            "weight": "bold",
                            "color": "#FFFFFF",
                            'wrap': true
                        },
                            {
                                "type": "text",
                                "text": "Tanggal: " + date,
                                "size": "xs",
                                "color": "#FFFFFF",
                                "margin": "md",
                                'wrap': true
                            },
                            {
                                "type": "text",
                                "text": "Waktu: " + timeStart + " - " + timeEnd + " (" + duration + " menit)",
                                "size": "xs",
                                "color": "#FFFFFF",
                                "margin": "md",
                                'wrap': true
                            },
                            {
                                "type": "text",
                                "text": "Pembuat: " + pembuat,
                                "size": "xs",
                                "color": "#FFFFFF",
                                "margin": "md",
                                'wrap': true
                            },
                        ],
                        "margin": "md"
                    },
                    {
                        "type": "separator",
                        "margin": "xxl",
                        "color": "#FFFFFF"
                    },
                );

                count = count + 1;
            }
        }
    }

    if (count === 0) {
        konten.push({
                "type": "text",
                "text": "Zoom Meeting belum dipinjam sama sekali 😄",
                "size": "sm",
                "color": "#FFFFFF",
                "wrap": true,
                "align": "center"
            }
        );
    }

    let msg =
        {
            "type": "bubble",
            "size": "kilo",
            "header": {
                "type": "box",
                "layout": "vertical",
                "contents": [{
                    "type": "text",
                    "text": "Informasi Zoom Meeting",
                    "color": "#FFFFFF",
                    "align": "center",
                    "gravity": "center",
                    "weight": "bold",
                    "wrap": true,
                    "size": "sm"
                }],
                "backgroundColor": "#0c2461"
            },
            "body": {
                "type": "box",
                "layout": "vertical",
                "contents": konten,
                "backgroundColor": "#4a69bd",
            },
            "footer": {
                "type": "box",
                "layout": "vertical",
                "contents": [{
                    "type": "text",
                    "text": "Sekarang bisa start dua Zoom Meeting bersamaan. Cek Zoom Meeting on progress dengan keyword /live",
                    "color": "#FFFFFF",
                    "align": "center",
                    "gravity": "center",
                    "wrap": true,
                    "size": "xs"
                }],
                "backgroundColor": "#0c2461"
            }
        }
    await context.sendFlex("Informasi Zoom Meeting", msg);
}

async function startZoom(context){
    await updateToken();
    const id = context.event.text.substring(7);

    const request = async () => {
        const respon = await axios.get("https://api.zoom.us/v2/meetings/" + id, { headers: await getHeaderZoom() });
        return [respon.status,respon.data] ;
    }
    const data = await request();
    let msg;

    if(data[0] === 200){
        let startUrl = data[1].start_url;
        let newUrl = startUrl.replace("telkomsel.","");
        msg =
            {
                "type": "bubble",
                "size": "kilo",
                "body": {
                    "type": "box",
                    "layout": "vertical",
                    "contents": [
                        {
                            "type": "text",
                            "text": "Silakan tekan tombol di bawah ini untuk memulai Zoom Meeting",
                            "wrap": true,
                            "color": "#FFFFFF",
                            "size": "sm",
                            "flex": 5
                        },
                        {
                            "type": "button",
                            "action": {
                                "type": "uri",
                                "uri": newUrl,
                                "label": "Start Meeting"
                            },
                            "style": "primary",
                            "height": "sm",
                            "color": "#0c2461",
                            "gravity": "center",
                            "margin": "md",
                            "flex": 3
                        }
                    ]
                },
                "styles": {
                    "body": {
                        "backgroundColor": "#4a69bd"
                    }
                }
            };
    }
    else{
        msg =
            {
                "type": "bubble",
                "size": "kilo",
                "body": {
                    "type": "box",
                    "layout": "vertical",
                    "contents": [
                        {
                            "type": "text",
                            "text": "Zoom Meetings dengan ID " + id + " tidak ditemukan",
                            "wrap": true,
                            "color": "#FFFFFF",
                            "size": "xs"
                        }
                    ]
                },
                "styles": {
                    "body": {
                        "backgroundColor": "#4a69bd"
                    }
                }
            };
    }
    await context.sendFlex("Start Zoom Meeting", msg);
}

async function zoomOnProgress(context){
    await updateToken();
    const request = async () => {
        const respon = await axios.get("https://api.zoom.us/v2/users/me/meetings?type=live", { headers: await getHeaderZoom() });
        return respon.data ;
    }
    const meetings = await request();
    let message = "Zoom Meeting yang sedang digunakan sekarang:\n";

    if(meetings[0] == null){
        message = message + "\nTidak ada Zoom Meeting yang sedang berjalan 😄";
    }
    else{
        for(let i=0 ; i < meetings.length ; ++i){
            let topic = meetings[i].topic;
            let type = meetings[i].type;
            let pembuat = meetings[i].agenda;
            let startTime = new Date(meetings[i].start_time).toLocaleString('id-ID',{timeStyle: 'short'});
            let endTime = new Date((new Date(meetings[i].start_time).getTime()) + (meetings[i].duration * 60000)).toLocaleString('id-ID',{timeStyle: 'short'});

            if(type === 2){
                message = message + "\n*Topik: " + topic + "*\nWaktu: " + startTime + " - " + endTime + "\nPembuat: " + pembuat + "\n\n";
            }
            else{
                message = message + "\nTopik: " + topic + "\nWaktu: Recurring Meeting\nPembuat: " + pembuat + "\n\n";
            }
        }
    }

    await context.sendText(message);
}

async function getZoomInvite(context){
    await updateToken();
    const id = context.event.text.substring(6);

    const request = async () => {
        const respon = await axios.get("https://api.zoom.us/v2/meetings/" + id, { headers: await getHeaderZoom() });
        return respon.data;
    }
    const data = await request();

    let topic = data.topic;
    let zoomID = id.toString();
    let pass = data.password;
    let desc = data.agenda;
    let date = new Date(data.start_time).toLocaleString('id-ID',{dateStyle: 'full'});
    let start = new Date(data.start_time).toLocaleString('id-ID',{timeStyle: 'short'});
    let dur = data.duration;
    let end = new Date((new Date(data.start_time).getTime()) + (dur * 60000)).toLocaleString('id-ID',{timeStyle: 'short'});
    let url = data.join_url;

    let message =
        desc + " mengajak Anda untuk bergabung ke Zoom Meeting.\n\n" +
        "*Topik: " + topic + "*\n" +
        "Tanggal: " + date + "\n" +
        "Waktu: " + start + " - " + end + " (" + dur + " menit)\n" +
        "Join URL: " + url.replace("telkomsel.","") + "\n\n" +
        "Meeting ID: " + zoomID.substring(0,3) + " " + zoomID.substring(3,7) + " " + zoomID.substring(7) + "\n" +
        "Passcode: " + pass + "\n";

    await context.sendText(message);
}

async function deleteZoom(context){
    await updateToken();
    const id = context.event.text.substring(8);

    const request = async () => {
        const respon = await axios.delete("https://api.zoom.us/v2/meetings/" + id, { headers: await getHeaderZoom() });
        return respon.status;
    }
    const status = await request();

    let msg;
    (status === 204) ? msg = "Zoom Meeting dengan ID " + id + " berhasil dibatalkan"
        : msg = "Zoom Meeting dengan ID " + id + " tidak ditemukan";
    await context.sendText(msg);
}