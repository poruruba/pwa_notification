'use strict';

//const vConsole = new VConsole();
//window.datgui = new dat.GUI();

const base_url = "【Node.jsサーバのURL】";
const EXPIRES = 356 * 10;

var vue_options = {
    el: "#top",
    mixins: [mixins_bootstrap],
    data: {
        client_id: null,
        message_list: [],
        latest_date: -1,
    },
    computed: {
    },
    methods: {
        to_datestring: function(time){
            return new Date(time).toLocaleString('ja-JP', { "year": "numeric", "month": "2-digit", "day": "2-digit", "hour": "numeric", "minute": "2-digit", "second": "2-digit" });
        },
        is_today: function(time){
            var today = new Date();
            var target = new Date(time);
            return ( today.getFullYear() == target.getFullYear() && today.getMonth() == target.getMonth() && today.getDate() == target.getDate() );
        },
        clipboard_copy: async function (text) {
            this.clip_copy(text);
            this.toast_show("クリップボードにコピーしました。");
        },
        update_list: function(list){
            if (this.message_list.length > 0)
                this.latest_date = this.message_list[0].created_at;
            this.message_list = list;
            if (this.message_list.length > 0)
                Cookies.set('notification_latest', this.message_list[0].created_at, { expires: EXPIRES });
        },
        notify_update: async function (item) {
            var result = await do_post_apikey(base_url + '/notification-update', { client_id: this.client_id, uuid: item.uuid, protect: item.protect }, this.apikey);
            console.log(result);
        },
        notify_deleteall: async function(){
            if( !confirm('本当に削除しますか？') )
                return;
            var result = await do_post_apikey(base_url + '/notification-deleteall', { client_id: this.client_id }, this.apikey);
            console.log(result);
            this.update_list(result.result);
        },
        notify_list: async function(){
            var result = await do_post_apikey(base_url + '/notification-list', { client_id: this.client_id }, this.apikey);
            console.log(result);
            this.update_list(result.result);
        },
        notify_text: async function(){
            var value = prompt("テキストを入力してください。");
            if (!value)
                return;
            var result = await do_post_apikey(base_url + '/notification-notify', { client_id: this.client_id, message: value }, this.apikey);
            console.log(result);
            this.update_list(result.result);
        },
        set_apikey: function () {
            var value = prompt("API Keyを指定してください。", this.apikey);
            if (!value)
                return;

            this.apikey = value;
            Cookies.set("notification_apikey", this.apikey, { expires: EXPIRES });
            alert('設定しました。リロードしてください。');
        },
        do_subscribe: async function () {
            navigator.serviceWorker.ready.then(async (registration) => {
                try {
                    if (this.client_id) {
                        var client_id = this.client_id;
                        this.client_id = null;
                        Cookies.remove('notification_client_id');
                        registration.pushManager.getSubscription().then((subscription) => {
                            subscription.unsubscribe();
                            alert('通知を解除しました。');
                        });
                        await do_post_apikey(base_url + '/notification-delete-object', { client_id: client_id }, this.apikey);
                    } else {
                        var json = await do_post_apikey(base_url + '/notification-get-pubkey', {}, this.apikey);

                        var object = await registration.pushManager.subscribe({
                            userVisibleOnly: true,
                            applicationServerKey: json.result.vapidkey
                        });
                        var test = JSON.parse(JSON.stringify(object));
                        console.log(test);
                        await do_post_apikey(base_url + '/notification-put-object', { client_id: json.result.client_id, object: object }, this.apikey);

                        this.client_id = json.result.client_id;
                        Cookies.set('notification_client_id', this.client_id, { expires: EXPIRES });
                    }
                } catch (error) {
                    console.error(error);
                    alert(error);
                }
            });
        }
    },
    created: function(){
    },
    mounted: function(){
        proc_load();

        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').then(async (registration) => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            }).catch((err) => {
                console.log('ServiceWorker registration failed: ', err);
            });
        }

        this.client_id = Cookies.get('notification_client_id');
        this.latest_date = Cookies.get('notification_latest');
        this.apikey = Cookies.get('notification_apikey');
        if (this.apikey )
            this.notify_list();
    }
};
vue_add_data(vue_options, { progress_title: '' }); // for progress-dialog
vue_add_global_components(components_bootstrap);

/* add additional components */

window.vue = new Vue( vue_options );

function do_post_apikey(url, body, apikey) {
    const headers = new Headers({ "Content-Type": "application/json; charset=utf-8", "X-API-KEY": apikey });

    return fetch(url, {
        method: 'POST',
        body: JSON.stringify(body),
        headers: headers
    })
        .then((response) => {
            if (!response.ok)
                throw 'status is not 200';
            return response.json();
        });
}