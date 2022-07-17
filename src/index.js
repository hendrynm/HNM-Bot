// BOTTENDER
const { router, line } = require('bottender/router');

// AXIOS API
const axios = require('axios');

// POSTGRESQL
const mariadb = require('mariadb');
const pool = mariadb.createPool({
    host: process.env.MARIADB_HOST,
    database: process.env.MARIADB_DATABASE,
    user: process.env.MARIADB_USERNAME,
    password: process.env.MARIADB_PASSWORD,
    connectionLimit: 5,
    ssl: false,
});

// LINE API HEADER
const headerLine = {
    'Content-Type': 'application/json; charset=UTF-8',
    'Authorization': 'Bearer ' + process.env.LINE_ACCESS_TOKEN
}

// ZOOM API HEADER
async function getHeaderZoom() {
    const conn = await pool.getConnection();
    const requestToken = async () => {
        return await conn.query("SELECT token FROM zoom WHERE id = 1");
    }
    const ambilToken = await requestToken();
    const token = Buffer.from((ambilToken[0].token),'base64url').toString('utf-8');

    await conn.release();
    await conn.end();

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

async function HandleMessage(context){
    if(context.event.isText){
        const userMsg = context.event.text;
        const maintenance = process.env.MAINTENANCE_MODE;

        if(userMsg.substring(0,1) === '/'){
            if(maintenance === 'ON'){
                return context.replyText("Mohon maaf, saat ini kami sedang melakukan *maintenance*. Silakan coba kembali pada waktu lain.");
            }
            else{
                if(await checkBlock(context)){
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
                    else if(userMsg.substring(0,4) === '/rec'){
                        return zoomRecord(context);
                    }
                    else if(userMsg.substring(0,8) === '/history'){
                        return getPastMeeting(context);
                    }
                    else if(userMsg.substring(0,7) === '/delete'){
                        return deleteZoom(context);
                    }
                    else if(userMsg.substring(0,5) === '/part'){
                        return getParticipant(context);
                    }
                    else if(userMsg === '/help'){
                        return getHelp(context);
                    }
                    else if(userMsg === '/leave'){
                        return leaveLine(context);
                    }
                    else if(userMsg.substring(0,1) === "/"){
                        return context.replyText("Kode tersebut belum tersedia.");
                    }
                }
                else{
                    if(userMsg === '/help'){
                        return getHelp(context);
                    }
                    else{
                        return context.replyText("Maaf, kamu telah DIBLOKIR dari pengunaan bot ini karena PELANGGARAN. Kamu dapat meminta pembukaan blokir dengan menghubungi pembuat bot pada menu /help . Terima kasih atas pemahaman kamu.");
                    }
                }
            }
        }
    }
}

async function getHelp(context) {
    let opening =
        "*SELAMAT DATANG DI tekan.id BOT 👋*\n" +
        "*Berikut adalah fitur Bot yang tersedia saat ini:*\n\n";

    let fitur =
        "*1. List jadwal Zoom Meeting yang sudah di-Booking:*\n" +
        "Ketik /zoom\n\n" +
        "*2. Booking Zoom Meeting:*\n" +
        "Ketik /book diikuti dengan Judul, tanggal (YYYY-MM-DD), waktu (HH:mm), durasi (dalam menit), dan passcode (maksimal 10 karakter, boleh pake huruf). Setiap variabel dipisah menggunakan tanda koma berspasi ( , ).\nContoh: /book Kerja Kelompok Alpro , 2021-08-31 , 19:00 , 60 , Satu234\n\n" +
        "*3. Start Zoom Meeting:*\n" +
        "Ketik /start spasi Meeting ID.\nContoh: /start 8275960095\n\n" +
        "*4. Cancel Zoom Meeting:*\n" +
        "Ketik /delete spasi Meeting ID.\nContoh: /delete 8275960095\n\n" +
        "*5. Invitation Zoom Meeting:*\n" +
        "Ketik /info spasi Meeting ID.\nContoh: /info 8275960095\n\n" +
        "*6. Zoom Meeting on progress:*\n" +
        "Ketik /live\n\n" +
        "*7. Cek Cloud Recording:*\n" +
        "Ketik /rec spasi Meeting ID.\nContoh: /rec 8275960095\n\n" +
        "*8. Cek partisipan di Zoom Meeting:*\n" +
        "Ketik /part spasi Meeting ID.\nContoh: /part 8275960095\n\n" +
        "*9. Cek riwayat pemakaian di Zoom Meeting:*\n" +
        "Ketik /history spasi Meeting ID.\nContoh: /history 8275960095\n\n";

    let ending =
        "Jika kamu memiliki kritik, saran, atau ide untuk pengembangan Bot ini, hubungi Hendry melalui: \nLine: https://line.me/ti/p/~hendry.naufal \nWhatsApp: https://wa.me/6285331303015 .";

    let msg = opening + fitur + ending;
    await context.replySticker({packageId: "8522", stickerId: "16581282"});
    await context.replyText(msg);
}

async function checkBlock(context) {
    const userID = context._event._rawEvent.source.userId;

    const conn = await pool.getConnection();
    const requestData = async() => {
        return await conn.query(`SELECT (CAST((COUNT(id_user)) as CHAR(1))) as hitung FROM line WHERE id_user = '${userID}' AND status = '1'`);
    }
    const result = await requestData();
    await conn.release();
    await conn.end();

    return (result[0].hitung === '0');
}

async function getLineName(context) {
    const userID = context._event._rawEvent.source.userId;

    const request = async () => {
        const respon = await axios.get("https://api.line.me/v2/bot/profile/" + userID, {headers: headerLine});
        return respon.data;
    }
    const data = await request();
    const displayName = data.displayName;

    const conn = await pool.getConnection();
    const requestData = async() => {
        return await conn.query(`SELECT COUNT(id_user) FROM line WHERE id_user = '${userID}'`);
    }
    const result = await requestData();
    console.log(result);
    if (result[0].count === '0'){
        const request1 = async() => {
            return await conn.query(`INSERT INTO line VALUES('${userID}','${displayName}')`);
        }
        await request1();
    }
    await conn.release();
    await conn.end();
    return data.displayName;
}

function leaveLine(context) {
    const groupID = context._event._rawEvent.source.groupId || undefined;
    const roomID = context._event._rawEvent.source.roomId || undefined;
    context.replySticker({packageId: "6370", stickerId: "11088025"});
    context.replyText("Terima kasih telah menggunakan tekan.id BOT. Sampai jumpa 👋");

    if(roomID === undefined) {
        axios.post("https://api.line.me/v2/bot/group/" + groupID + "/leave", [], {headers: headerLine});
    }
    else if(groupID === undefined) {
        axios.post("https://api.line.me/v2/bot/room/" + roomID + "/leave", [], {headers: headerLine});
    }
}

async function updateToken(){
    const conn = await pool.getConnection();
    const requestData = async() => {
        return await conn.query("SELECT * FROM zoom WHERE id = 1");
    }
    const result = await requestData();
    const now = new Date().getTime();

    const time = result[0].time;
    let last = Number(time) + 3600000;

    if(last <= now){
        const client = process.env.ZOOM_CLIENT_ID;
        const secret = process.env.ZOOM_CLIENT_SECRET;
        const keyLocked = Buffer.from(client + ":" + secret).toString('base64');
        const oldRefToken = Buffer.from((result[0].refresh),'base64url').toString('utf-8')

        const request = async () => {
            const respon = await axios({
                method: 'post',
                url: 'https://zoom.us/oauth/token?grant_type=refresh_token&refresh_token=' + oldRefToken,
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': 'Basic ' + keyLocked
                }
            });
            return respon.data;
        }
        const data = await request();

        console.log(data.access_token);
        console.log(data.refresh_token);

        const acc_token = "('" + Buffer.from(data.access_token).toString('base64url') + "')";
        const ref_token = "('" + Buffer.from(data.refresh_token).toString('base64url') + "')";
        const now_token = String(new Date().getTime());

        const request1 = async() => {
            return await conn.query(`UPDATE zoom SET token = ${acc_token}, refresh = ${ref_token}, time = ${now_token} WHERE id = 1`);
        }
        await conn.release();
        await conn.end();
        await request1();
    }
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

    if(passcode === undefined){
        msg = "Format keyword salah ⛔, kirim /help untuk melihat format keyword yang benar 😉";
    }
    else if(date.substring(4,5) !== "-" || date.substring(7,8) !== "-"){
        msg = "Format tanggal salah ⛔, pastikan menggunakan strip ( - )";
    }
    else if(time.substring(2,3) !== ":"){
        msg = "Format jam salah ⛔, pastikan menggunakan titik dua ( : )";
    }
    else if(/[a-zA-Z]/g.test(duration)){
        msg = "Durasi meeting tidak boleh mengandung huruf ⛔";
    }
    else if(duration > 360){
        msg = "Durasi meeting terlalu lama ⛔, tolong konfirmasi ke pembuat bot untuk schedule manual 😉";
    }
    else if(passcode.length > 10){
        msg = "Passcode terlalu panjang ⛔, maksimal 10 digit";
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
    await context.replySticker({packageId: "8522", stickerId: "16581266"});
    await context.replyText(msg);
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
        let timeEnd = new Date((new Date(data[i].start_time)).getTime() + (duration * 60000)).toLocaleString('id-ID', {timeStyle: 'short'});

        if (id === '' || id === null) {
            break;
        } else {
            if (type === 2 || type === 8) {
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
                    "text": "Informasi Jadwal Pemakaian Zoom Meeting",
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
                    "text": "Perlu bantuan? ketik /help dan kami akan membantumu.",
                    "color": "#FFFFFF",
                    "align": "center",
                    "gravity": "center",
                    "wrap": true,
                    "size": "xs"
                }],
                "backgroundColor": "#0c2461"
            }
        }
    await context.replySticker({packageId: "8522", stickerId: "16581273"});
    await context.replyFlex("Informasi Jadwal Pemakaian Zoom Meeting", msg);
    await context.replyText("PERHATIAN!!!\nDalam satu waktu yang bersamaan hanya boleh ada MAKSIMAL DUA Zoom Meeting!");
}

async function startZoom(context){
    if(await checkZoomOnProgress() === true){
        await updateToken();
        await deletePicture();
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
        await context.replySticker({packageId: "8522", stickerId: "16581289"});
        await context.replyFlex("Start Zoom Meeting", msg);
    }
    else{
        await context.replyText("Saat ini sedang ada dua Zoom Meeting yang berjalan bersamaan. Silakan akhiri salah satu Zoom Meeting berikut untuk melanjutkan.");
        await zoomOnProgress(context);
    }
}

async function checkZoomOnProgress(){
    await updateToken();
    const request = async () => {
        const respon = await axios.get("https://api.zoom.us/v2/users/me/meetings?type=live", { headers: await getHeaderZoom() });
        return respon.data ;
    }
    const hasil = await request();
    const count = hasil.total_records;
    return (count < 2);
}

async function zoomOnProgress(context){
    await updateToken();
    const request = async () => {
        const respon = await axios.get("https://api.zoom.us/v2/users/me/meetings?type=live", { headers: await getHeaderZoom() });
        return respon.data ;
    }
    const hasil = await request();
    const meetings = hasil.meetings;
    console.log(meetings);
    let message = "Daftar Zoom Meeting yang sedang digunakan sekarang:\n";

    if(meetings[0] == null){
        message = message + "\nTidak ada 😄";
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
                message = message + "\n*Topik: " + topic + "*\nWaktu: Recurring Meeting\nPembuat: " + pembuat + "\n\n";
            }
        }
    }
    await context.replySticker({packageId: "6370", stickerId: "11088035"});
    await context.replyText(message);
}

async function getZoomInvite(context){
    await updateToken();
    const id = context.event.text.substring(6);

    const request = async () => {
        const respon = await axios.get("https://api.zoom.us/v2/meetings/" + id, { headers: await getHeaderZoom() });
        return [respon.status,respon.data];
    }
    const hasil = await request();

    if(hasil[0] === 200){
        const data = hasil[1];

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
            "Waktu: " + start + " - " + end + " (" + dur + " menit)\n\n" +
            "Join Zoom Meeting\n" + url.replace("telkomsel.","") + "\n\n" +
            "Meeting ID: " + zoomID.substring(0,3) + " " + zoomID.substring(3,7) + " " + zoomID.substring(7) + "\n" +
            "Passcode: " + pass + "\n";

        await context.replyText(message);
    }
    else{
        await context.replyText("Zoom Meeting tidak ditemukan");
    }

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
    (status === 204) ? msg = "Zoom Meeting dengan ID " + id + " berhasil dibatalkan."
        : msg = "Zoom Meeting dengan ID " + id + " tidak ditemukan.";
    await context.replyText(msg);
}

async function zoomRecord(context){
    await updateToken();
    const id = context.event.text.substring(5);
    const uuid = encodeURIComponent(encodeURIComponent(id));

    const request = async () => {
        const respon = await axios.get("https://api.zoom.us/v2/meetings/" + uuid +"/recordings", { headers: await getHeaderZoom() });
        return [respon.status,respon.data] ;
    }
    const hasil = await request();
    const data = hasil[1];

    if(hasil[0] === 200){
        let topik = data.topic;
        let start = new Date(data.start_time).toLocaleString('id-ID',{dateStyle: 'full', timeStyle: 'short'});
        let durasi = data.duration + " menit";
        let totalSize = (Math.ceil((data.total_size)/1024/1024)) + " MB";
        let shareUrl = (data.share_url).replace("telkomsel.","");
        let recData = data.recording_files;
        let sizeSSSV, urlSSSV, sizeSSGV, urlSSGV, sizeSV, urlSV, sizeGV, urlGV, sizeSS, urlSS, sizeCF, urlCF;

        for(let i = 0 ; i < (recData.length) ; i++){
            let tipe = recData[i].recording_type;
            switch(tipe){
                case("shared_screen_with_speaker_view"):
                    sizeSSSV = (Math.ceil((recData[i].file_size)/1024/1024)) + " MB" || undefined;
                    urlSSSV = (recData[i].download_url).replace("telkomsel.","") || undefined;
                    break;
                case("shared_screen_with_gallery_view"):
                    sizeSSGV = (Math.ceil((recData[i].file_size)/1024/1024)) + " MB" || undefined;
                    urlSSGV = (recData[i].download_url).replace("telkomsel.","") || undefined;
                    break;
                case("speaker_view"):
                    sizeSV = (Math.ceil((recData[i].file_size)/1024/1024)) + " MB" || undefined;
                    urlSV = (recData[i].download_url).replace("telkomsel.","") || undefined;
                    break;
                case("gallery_view"):
                    sizeGV = (Math.ceil((recData[i].file_size)/1024/1024)) + " MB" || undefined;
                    urlGV = (recData[i].download_url).replace("telkomsel.","") || undefined;
                    break;
                case("shared_screen"):
                    sizeSS = (Math.ceil((recData[i].file_size)/1024/1024)) + " MB" || undefined;
                    urlSS = (recData[i].download_url).replace("telkomsel.","") || undefined;
                    break;
                case("chat_file"):
                    sizeCF = (Math.ceil((recData[i].file_size)/1024)) + " KB" || undefined;
                    urlCF = (recData[i].download_url).replace("telkomsel.","") || undefined;
                    break;
            }
        }

        let msg =
            "*Topik: " + topik + "*\n" +
            "Waktu Start Meeting: " + start + "\n" +
            "Durasi Meeting: " + durasi + "\n" +
            "Size Recording: " + totalSize + "\n" +
            "Link Menonton: " + shareUrl + "\n\n"
        ;

        let msg2 =
            "*Daftar Link Download per Jenis Recording: \n\n*" +
            "*1. Share Screen With Speaker View*\n" +
            ((sizeSSSV === undefined) ? "Tidak tersedia\n\n" : urlSSSV + " (" + sizeSSSV + ")\n\n") +
            "*2. Share Screen With Gallery View*\n" +
            ((sizeSSGV === undefined) ? "Tidak tersedia\n\n" : urlSSGV + " (" + sizeSSGV + ")\n\n") +
            "*3. Speaker View*\n" +
            ((sizeSV === undefined) ? "Tidak tersedia\n\n" : urlSV + " (" + sizeSV + ")\n\n") +
            "*4. Gallery View*\n" +
            ((sizeGV === undefined) ? "Tidak tersedia\n\n" : urlGV + " (" + sizeGV + ")\n\n") +
            "*5. Share Screen*\n" +
            ((sizeSS === undefined) ? "Tidak tersedia\n\n" : urlSS + " (" + sizeSS + ")\n\n") +
            "*6. Chat File*\n" +
            ((sizeCF === undefined) ? "Tidak tersedia\n\n" : urlCF + " (" + sizeCF + ")\n\n")
        ;

        await context.replyText(msg);
        await context.replyText(msg2);
    }
    else{
        await context.replyText("Hasil Recording tidak ditemukan");
    }
}

async function deletePicture(){
    const req = async () => {
        const res = await axios.delete("https://api.zoom.us/v2/users/me/picture", { headers: await getHeaderZoom() });
        return [res.status] ;
    }
    await req();
}

async function getPastMeeting(context){
    await updateToken();
    const id = context.event.text.substring(9);

    const request = async () => {
        const respon = await axios.get("https://api.zoom.us/v2/past_meetings/" + id + "/instances", { headers: await getHeaderZoom() });
        return [respon.status,respon.data] ;
    }
    const hasil = await request();
    let msg = "*Riwayat penggunaan Zoom Meeting*\n\n";

    if(hasil[0] === 200){
        const data1 = hasil[1].meetings;
        const sorted = data1.sort((a, b) => new Date(b.start_time).getTime() - new Date(a.start_time).getTime());

        msg = msg + "*TERBARU*\n" + "Unique ID: " + sorted[0].uuid + "\nWaktu Mulai: " +
            new Date(sorted[0].start_time).toLocaleString('id-ID', {dateStyle: 'full', timeStyle: 'short'}) + "\n\n";

        for(let i=1 ; i < sorted.length ; i++){
            msg = msg + "Unique ID: " + sorted[i].uuid + "\nWaktu Mulai: " +
                new Date(sorted[i].start_time).toLocaleString('id-ID', {dateStyle: 'full', timeStyle: 'short'}) + "\n\n";
        }
    }
    else{
        msg = "Kode Zoom Meeting tidak ditemukan";
    }
    await context.replyText(msg);
}

async function getParticipant(context){
    await updateToken();
    const id = context.event.text.substring(6);
    const uuid = encodeURIComponent(encodeURIComponent(id));

    const request = async () => {
        const respon = await axios.get("https://api.zoom.us/v2/past_meetings/" + uuid + "/participants?page_size=300", { headers: await getHeaderZoom() });
        return [respon.status,respon.data] ;
    }
    const hasil = await request();
    let msg;
    let konten = [];

    if(hasil[0] === 200){
        const page = hasil[1].page_count;
        let next_token = hasil[1].next_page_token || undefined;
        let data = hasil[1].participants;

        for(let i=1 ; i <= page; i++){
            for(let j=0 ; j < data.length ; j++){
                if(konten.indexOf(data[j].name) === -1){
                    konten.push(data[j].name);
                }
            }

            if(next_token !== undefined){
                const req2 = async () => {
                    const respon = await axios.get("https://api.zoom.us/v2/past_meetings/" + uuid + "/participants?page_size=300&next_page_token=" + next_token, { headers: await getHeaderZoom() });
                    return respon.data ;
                }
                const hasil2 = await req2();
                next_token = hasil2.next_page_token || undefined;
                data = hasil2.participants;
            }
        }
        msg = "*Daftar Kehadiran di Zoom Meeting*\n*Total Kehadiran: " + konten.length + " orang.*\n\n";

        for(let i=0 ; i < konten.length ; i++){
            msg = msg + (i+1) + ". " + konten[i] + "\n";
        }
    } else{
        msg = "Zoom Meeting tidak ditemukan";
    }
    await context.replyText(msg);
}