'use strict';

const HELPER_BASE = process.env.HELPER_BASE || '../../helpers/';
const Response = require(HELPER_BASE + 'response');

const FILE_BASE = './data/notification/';
//const NOTIFICATION_SUBJECT = "mailto:test@test.com";
const NOTIFICATION_SUBJECT = "http://test.com";

const webpush = require('web-push');
const fs = require('fs').promises;
//const uuidv4 = require('uuid/v4');
const uuidv4 = require('uuid').v4;

exports.handler = async (event, context, callback) => {
	var body = JSON.parse(event.body);
	var apikey = event.requestContext.apikeyAuth.apikey;
	if (!checkAlnum(apikey))
		throw 'apikey invalid';

	var obj = await readVapidFile(apikey);

	if (event.path == '/notification-get-pubkey') {
		var uuid = uuidv4();
		return new Response({ result: { vapidkey: obj.vapidkey.publicKey, client_id: uuid } });
	} else
	if (event.path == '/notification-put-object') {
		obj.objects[body.client_id] = body.object;
		await writeVapidFile(apikey, obj);

		await sendNotification(obj.vapidkey, obj.objects[body.client_id], { title: "ノーティフィケーション", body: "通知を登録しました。" });

		return new Response({});
	} else
	if (event.path == '/notification-delete-object') {
		var object = obj.objects[body.client_id];
		delete obj.objects[body.client_id];
		await writeVapidFile(apikey, obj);

		return new Response({});
	}

	if (event.path == '/notification-notify') {
		var uuid = uuidv4();

		obj.list.push({ uuid: uuid, message: body.message, protect: false, created_at: new Date().getTime() });
		await writeVapidFile(apikey, obj);

		var keys = Object.keys(obj.objects);
		for (var i = 0; i < keys.length; i++) {
			try {
				await sendNotification(obj.vapidkey, obj.objects[keys[i]], { title: "ノーティフィケーション", body: body.message });
			} catch (error) {
				console.error(error);
			}
		}

		return new Response({ result: get_list(obj) });
	} else
	if (event.path == '/notification-list') {
		return new Response({ result: get_list(obj) });
	} else
	if( event.path == '/notification-update' ){
		var item = obj.list.find(item => item.uuid == body.uuid );
		if( !item )
			throw 'item not found';

		if( body.protect !== undefined ){
			item.protect = body.protect;
		}

		await writeVapidFile(apikey, obj);

		return new Response({ result: get_list(obj) });
	}else
	if( event.path == '/notification-deleteall' ){
		var list = obj.list.filter( item => item.protect );
		obj.list = list;

		await writeVapidFile(apikey, obj);

		return new Response({ result: get_list(obj) });
	}
}

function get_list(obj){
	var list = obj.list.map(item => {
		return { uuid: item.uuid, message: item.message, protect: item.protect, created_at: item.created_at }
	});

	list.sort((a, b) => {
		return b.created_at - a.created_at;
	});

	return list;
}

function checkAlnum(str) {
	var ret = str.match(/([a-z]|[A-Z]|[0-9])/gi);
	return (ret.length == str.length)
}

async function readVapidFile(apikey) {
	try {
		var obj = await fs.readFile(FILE_BASE + apikey + '.json', 'utf8');
		if (!obj) {
			obj = {
				vapidkey: webpush.generateVAPIDKeys(),
				list: [],
				objects: {}
			};
			await writeVapidFile(apikey, obj);
		} else {
			obj = JSON.parse(obj);
		}
		return obj;
	} catch (error) {
		throw "not found";
	}
}

async function writeVapidFile(apikey, obj) {
	await fs.writeFile(FILE_BASE + apikey + '.json', JSON.stringify(obj, null, 2), 'utf8');
}

async function sendNotification(vapidkey, object, content) {
	var options = {
		vapidDetails: {
			subject: NOTIFICATION_SUBJECT,
			publicKey: vapidkey.publicKey,
			privateKey: vapidkey.privateKey
		}
	};
	var result = await webpush.sendNotification(object, Buffer.from(JSON.stringify(content)), options);
	if (result.statusCode != 201)
		throw "status is not 201";
}