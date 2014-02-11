/*
Copyright (c) 2013, Intel Corporation

Redistribution and use in source and binary forms, with or without modification,
are permitted provided that the following conditions are met:

    * Redistributions of source code must retain the above copyright notice,
      this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright notice,
      this list of conditions and the following disclaimer in the documentation
      and/or other materials provided with the distribution.
    * Neither the name of Intel Corporation nor the names of its contributors
      may be used to endorse or promote products derived from this software
      without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON
ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

var mqtt = require('mqtt'),
    msg = require('./cloud-message').init(),
	registrationCompleted = false,
	sensorsList = {};

function IoTKitCloud(conf, logger, deviceId, sensorsStore){
  var me = this;

  me.logger = logger;
  me.sensorsStore = sensorsStore;

  var host = conf.host || 'broker.enableiot.com';
  var port = conf.port || 8884;
  var args = {
     keyPath: conf.key || './certs/client.key',
     certPath: conf.crt || './certs/client.crt',
     keepalive: 59000
  };

  me.deviceId = deviceId;
  me.accountId = "anon";
  me.pubArgs = {
    qos: conf.qos || 1, 
    retain: conf.retain || true
  };

  me.client = mqtt.createSecureClient(port, host, args);
  me.logger.info('Cloud client created. ' + host + ':' + port);

  me.topics = {
    reg: conf.reg_topic || 'data/registration',
    status: conf.status_topic || 'data/registration_status',
    metric: conf.metric_topic || 'data/metric/'
  };

  me.registrationCompleted = false;
  
	// subscribe for registration result
	me.client
	.subscribe(me.topics.status)
	.on('message', function(topic, message) {
	  me.logger.info('STATUS: %s', topic, message);
	  var regStatus = JSON.parse(message);
	  // Check registration status is true and device_id is ours
	  if(me.registrationCompleted = regStatus !== undefined
			&& regStatus.response !== undefined 
			&& regStatus.response.device_id == me.deviceId
				&& regStatus.response.status){  
		me.logger.info('Devices registered successfully');
		// populate accountId & apikey
		me.accountId = regStatus.response.account_id;
		me.apiKey = regStatus.response.api_key;
		// add the state specifics 
		me.topics.metric = 'data/metric/' + me.accountId + '/' + me.deviceId;
		// save registered sensors
		me.sensorsStore.saveSensorsList(me.sensorsList);
	  }
	}); 
};

IoTKitCloud.prototype.reg = function(sensorsListArg, regCompleted, accessToken) {
  var me = this;
  me.accessToken = accessToken || me.accessToken 
  me.sensorsList = sensorsListArg || me.sensorsList;
  var doc = msg.getRegMsg(me.deviceId, undefined, undefined, me.sensorsList, me.accessToken);
  me.logger.debug("Reg doc: %j", doc, {});
  me.pub(me.topics.reg, doc);
};

IoTKitCloud.prototype.metric = function(message){
  var me = this;
  var doc = msg.getMetricMsg(me.deviceId, me.accountId, me.apiKey, message);
  me.logger.debug("Metric doc: %j", doc, {});
  me.pub(me.topics.metric, doc);
};

IoTKitCloud.prototype.pub = function(topic, doc){
  var me = this;

  // Validate the input arg
  if (!doc || !topic) {
    logger.error('send: null args');
    return;
  }

  // Send to broker
  me.logger.debug('SEND: %s', topic, doc);
  me.client.publish(topic, JSON.stringify(doc), me.pubArgs);
};

exports.init = function(conf, logger, deviceId, sensorsStore) {
  return new IoTKitCloud(conf, logger, deviceId, sensorsStore);
};

// Export for testing purposes
exports.registrationCompleted = registrationCompleted;