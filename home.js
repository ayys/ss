import {button_restart, button_start, button_stop, button_delete, enable_all_buttons} from "./buttonStates.js";

var current_services = [];

async function getJobs() {
	return fetch("/job/").then(resp => {
		if (resp.status == 200)
			return resp.json();
		return new Promise(() => new Object());
	});
}

function load_active_tab(){
	let active_tab = localStorage.getItem("active_tab");
	if (active_tab && $(active_tab).length > 0) {
		$(".tab-pane").removeClass("active").removeClass("show");
		$(active_tab).addClass("active").addClass("show");
		$(".link").removeClass("active");
		$(`[href="${active_tab}"]`).addClass("active");
	} else {
		$("#no-services").addClass("active").addClass("show");
		$(`[href="#no-services"]`).addClass("active");
	}
}

function set_click_functions() {
	$(".button-service-stop:not(.bound)").addClass("bound").click(function () {
		stop(this);
	});
	$(".button-service-start:not(.bound)").addClass("bound").click(function() {
		start(this);
	});
	$(".button-service-restart:not(.bound)").addClass("bound").click(function () {
		restart(this);
	});
	$(".button-service-delete:not(.bound)").addClass("bound").click(function () {
		s_delete(this);
	});
	$(".button-service-toggle-autopilot:not(.bound)").addClass("bound").click(function () {
		toggle_autopilot(this);
	});
	$(".button-service-add-domain:not(.bound)").addClass("bound").click(function () {
		add_domain(this);
	});
	$(".button-service-delete-domain:not(.bound)").addClass("bound").click(function () {
		delete_domain(this);
	});
	$(".button-service-refresh-snapshot:not(.bound)").addClass("bound").click(function () {
		refresh_snapshot(this);
	});
	$(".button-service-restore-snapshot:not(.bound)").addClass("bound").click(function () {
		restore_snapshot(this);
	});
	$(".link:not(.bound)").addClass("bound").click(function () {
		clear_active(this);
	});
	$(".button-verify-domain:not(.bound)").addClass("bound").click(function () {
		verify_domain(this);
	});

}

let jobs = [];


let state_fetching = false;
let state_port = false;

function clear_active(el) {
	$(".link").each( (index, element) => {
		if ($(element).attr("href") != $(el).attr("href"))
			$(element).removeClass("active");
		else if (element != el && !$(element).hasClass("active")) {
			$(element).addClass("active");
		}
	} );
	let href = $(el).attr("href");
	localStorage.setItem("active_tab", href);
}


async function fetch_services(){
	if (!state_fetching){
		// wait for 2 seconds to reduce server crowding
		await new Promise(res => setTimeout(res, 2000));
		state_fetching = true;
		return fetch("/service/s/").then(resp => resp.json().then(data => {
			state_fetching = false;
			data.results.forEach((service) => {
				service['minutes_left'] = function() {
					return ((new Date() - this.creation_time) / 1000 / 60).toFixed(0);
				};
				service['get_creation_time'] = function() {
					return new Date(this.creation_time);
				};
			});
			current_services = data.results;
			return {
				response: resp,
				services : data.results
			};
		}));
	}
	return null;
}

async function fetch_keys(){
	// wait for 2 seconds to reduce server crowding
	return fetch("/sshkey/").then(resp => resp.json().then(data => {
		return {
			response: resp,
			keys : data.results
		};
	}));
}

async function fetch_ports(){
	return fetch("/ports/").then(resp => resp.json().then(data => {
		return {
			response: resp,
			keys : data.results
		};
	})).catch(e => {});
}

async function assign_port(button){
	let port_id = $(button).parent().parent().parent().attr("port-id");
	let service_id = $(`#${port_id}-service-select`).val();
	if (isNaN(service_id)){
		toastr.warning("Please select a service");
		return 0;
	}
	return fetch(`/ports/${port_id}/assign/?id=${service_id}`).then(resp => resp.json().then(data => {
		if (resp.status == 200) {
			render_ports().then(data => {});
			toastr.success(data.message, "Success");
		} else
			toastr.error(data.message, "Oops!");
	})).catch(e => {});
}


function set_services_tab(services){
	let services_tab_heading = $("#servicesTabHeadingTemplate").render({count: services.length});
	let services_tab = $("#servicesTabTemplate").render(services);
	$("#servicestab").html(services_tab_heading).append(services_tab);
    $(".link").addClass("bound").click(function () {
		clear_active(this);
    });
}

function set_services_tabpane(services){
	let service_panes = $("#serviceTemplate").render(services);
	let tabcontent = $("#actions-tabcontent");
	$(".generated-service-tab").remove();
	$("#actions-tabcontent").append(service_panes);
}

function set_keys(keys){
	let sshkeys = $("#sshKeyTemplate").render(keys);
	$("#list-ssh-keys").html(sshkeys);
	$(".ssh-key-delete").addClass("bound").click(function () {
		delete_sshkey(this);
	});
}

function set_ports(keys){
	let helpers = {
		services: current_services
	};
	let sshkeys = $("#portTemplate").render(keys, helpers);
	$("#list-ports").html(sshkeys);
	$(".port-delete").addClass("bound").click(function () {
		delete_port(this);
	});
	$(".assign-port-button").addClass("bound").click(function () {
		assign_port(this).then(data => {});
	});
}


async function render_services() {
	return fetch_services().then(data => {
		let services = [];
		if (data.response.status ==  200){
			services = data.services;
			set_services_tab(services);
			set_services_tabpane(services);
			load_active_tab();
			set_click_functions();
			render_ports().then(data => {});
		}
		current_services = services;
		return services;
	});
}


async function render_keys() {
	return fetch_keys().then(data => {
		let keys = [];
		if (data.response.status ==  200){
			keys = data.keys;
			set_keys(keys);
		}
		return keys;
	});
}

async function render_ports() {
	return fetch_ports().then(data => {
		let ports = [];
		if (data.response.status ==  200){
			ports = data.keys;
			set_ports(ports);
		}
		return ports;
	});
}



function loop(force=false) {
    // force is set to true by events such as button press which need to immediately call the function
    if (force == false && jobs.length == 0) {
		return;
	}
    getJobs().then((data) => {
		data = data.results;
		if (data.length < jobs.length) {
			// check if the job was completed or if it threw errors
			// get the jobs that were completed and show success for those only
			let completed_jobs = jobs.filter(job => !new Set(data).has(job));
			completed_jobs.forEach((job, index) => {
				if (job.status == "finished" || job.status == "Success")
					toastr.success(job.description);
				else if (job.status == "failed")
					toastr.error(job.description, "Oops!");
			});
			render_services().then((data) => {
			});
			jobs = data;
		} else if (data.length > jobs.length) {
			// get a list of new jobs
			let new_jobs = data.filter(job => !new Set(jobs).has(job));
			jobs = data;
			new_jobs.forEach((job) => toastr.info(job.description));
		}
		jobs = data;
		if (jobs.length > 0){
			let el = $("#currently-running-jobs");
			let tab = $("#jobs-tab");
			let html = "";
			tab.html( `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
 View Running Jobs <span class='badge badge-danger'>${jobs.length}</span>`);
			for (let job of jobs) {
				let icon = '';
				let on_click = "";
				if (job.status == "queued") {
					html += `
<div class="card mb-2">
  <div class="card-body">
    <div class="row">
      <div class="col-10">
        <i style="min-width: 30px;" class="far fa-lg fa-clock"></i> Job : ${job.description}
      </div>
      <div class="col-2">
        <button class="btn btn-outline-danger" onclick="stop_job(${job.id})">
          <i style="min-width: 30px;" class="fas fa-lg fa-trash-alt"></i>
        </button>
      </div>
    </div>
  </div>
</div>
					 `;
				} else {
					html += `
<div class="card mb-2">
  <div class="card-body">
    <div class="row">
      <div class="col-12">
        <i style="min-width: 30px;" class="fa fa-cog fa-spin fa-lg fa-fw"></i> Job : ${job.description}
      </div>
    </div>
  </div>
</div>
					 `;
				}
			}
			el.html(html);
		} else {
			let tab = $("#jobs-tab");
			tab.html( `<i class="fas fa-lg fa-running" style='min-width:30px;'></i> View your Jobs</span>`);
			let el = $("#currently-running-jobs");
			el.html("");
		}
    });
}

function create_service (ttl, package_id, os_id, autopilot, add_sshkey, csrf_token) {
    var url = '/service/s/';
    fetch(url, {
		method: "post",
		headers: {
			'Accept': 'application/json',
			'Content-Type': 'application/json',
			'X-CSRFToken': csrf_token
		},
		body: JSON.stringify({
			ttl: ttl,
			package: package_id,
			os: os_id,
			autopilot: autopilot,
			add_sshkey: add_sshkey
		})
    }).then(data => {
		if (data.status != 200)
			data.json().then(data => {
				toastr.error(data.message, "Could not create service!");
			});
		loop(true);				// force loop to call API
    });
}

function action_api(service_id, action) {
    var url = `/service/s/${service_id}/${action}/`;
	toastr.info(`The job has been addded to the queue`, `<span class="text-capitalize">${action.replace("_", " ")}</span>`);
    fetch(url).then(data => {
		if (data.status == 200)
			loop(true);				// force loop to call API
		else {
			data.json().then(json_data => {
				toastr.error(json_data.message, "Ops!");
			});
		}
    });
}

function stop(button) {
    var service_id = $(button).attr("service-id");
    button_stop(service_id);
    action_api(service_id, "stop");
}

function create(button) {
    let ttl = $("[name=ttl]").val();
    let package_id = $("[name=package]").val();
    let os_id = $("[name=os]").val();
    let autopilot = "false";
	let add_sshkey = "false";
	if ($("[name=autopilot]").is(":checked"))
		autopilot = "true";
	if ($("[name=add_sshkey]").is(":checked"))
		add_sshkey = "true";
    let csrf_token = $("[name=csrfmiddlewaretoken]").val();
    if (ttl == "" || package_id == "" || os_id == "" || isNaN(ttl) || isNaN(package_id) || isNaN(os_id)){
		toastr.error("Cannot create service because form is invalid!", "Oops!");
    }
    else {
		toastr.info("Starting service creation", "Service Action");
		create_service(ttl, package_id, os_id, autopilot, add_sshkey, csrf_token);
    }
}

function start(button) {
    var service_id = $(button).attr("service-id");
    button_start(service_id);
    action_api(service_id, "start");
}

function toggle_autopilot(button) {
    var service_id = $(button).attr("service-id");
    button_start(service_id);
    var url = `/service/s/${service_id}/toggle_autopilot/`;
    fetch(url).then(data => {
		if (data.status == 200)
			render_services().then((data) => {
				toastr.success("Autopilot was toggled", "Success!");
			});
		else
			toastr.error("Could not toggle autopilot for service!", "Ops!");
    });
}

function restart(button) {
    var service_id = $(button).attr("service-id");
    button_restart(service_id);
    action_api(service_id, "restart");
}

function refresh_snapshot(button) {
    var service_id = $(button).attr("service-id");
    action_api(service_id, "refresh_snapshot");
}

function restore_snapshot(button) {
    var service_id = $(button).attr("service-id");
    button_restart(service_id);
    action_api(service_id, "restore_snapshot");
}

function s_delete(button) {
    var service_id = $(button).attr("service-id");
    button_delete(service_id);
    action_api(service_id, "delete");
}

function add_domain(button) {
    let valid_hostname_regex=/^([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])(\.([a-zA-Z0-9]|[a-zA-Z0-9][a-zA-Z0-9\-]{0,61}[a-zA-Z0-9]))+$/;
    var service_id = $(button).attr("service-id");
    let csrf_token = $("[name=csrfmiddlewaretoken]").val();
    let hostname = $(`[name=${service_id}-domain-hostname]`).val();
    if (hostname == ""){
		toastr.error("Form to add new field is invalid!");
		return;
    }
    if (hostname.match(valid_hostname_regex) == undefined) {
		toastr.error("The hostname you entered is not valid!");
		return;
    }
    fetch(`/service/s/${service_id}/create_domain/`, {
		method: "post",
		headers: {
			'Accept': 'application/json',
			'Content-Type': 'application/json',
			'X-CSRFToken': csrf_token
		},
		body: JSON.stringify({
			schema: "http",
			hostname: hostname,
		})
    }).then(data => {
		if (data.status == 200) {
			render_services().then((data) => {
				toastr.success("New domain was successfully added", "Success!");
			});
		}
		else {
			data.json().then(data => {
				toastr.error(data.message, "Could not add domain");
			});

		}
    });
}

function verify_domain(button) {
    var domain_id = $(button).attr("domain-id");
    fetch(`/domains/${domain_id}/verify/`).then(resp => {
	if (resp.status == 200) {
	    render_services().then((data) => {});
	    toastr.success("Domain was successfully verified.", "Success!");
	}
	else
	    toastr.warning("Domain could not be verified. Please check your DNS settings, or wait for one minute before trying again.", "Oops!");
    });
}

function delete_domain(button) {
    var domain_id = $(button).attr("domain-id");
    let csrf_token = $("[name=csrfmiddlewaretoken]").val();
    fetch(`/domains/${domain_id}/`, {
		method: "delete",
		headers: {
			'X-CSRFToken': csrf_token
		}}).then(data => {
			if (data.status == 204) {
				render_services().then((data) => {
					toastr.success("Successfully removed domain from service");
				});
			}
			else {
				data.json().then(data => {
					toastr.error(data.message, "Could not remove domain");
				});
			}
		});
}

function delete_sshkey(button) {
    var key_id = $(button).attr("ssh-key-id");
    let csrf_token = $("[name=csrfmiddlewaretoken]").val();
    fetch(`/sshkey/${key_id}/`, {
		method: "delete",
		headers: {
			'X-CSRFToken': csrf_token
		}}).then(resp => {
			if (resp.status == 204) {
				render_keys().then((js) => {
					toastr.success("Successfully removed SSH Key");
				});
			}
			else {
				toastr.error("Could not remove SSH Key");
			}
		});
}

function delete_port(button) {
	if (state_port == false) {
		state_port = true;
		var key_id = $(button).attr("port-id");
		let csrf_token = $("[name=csrfmiddlewaretoken]").val();
		fetch(`/ports/${key_id}/`, {
			method: "delete",
			headers: {
				'X-CSRFToken': csrf_token
			}}).then(resp => {
				state_port = false;
				if (resp.status == 204) {
					render_ports().then((js) => {
						toastr.success("Successfully removed Port");
					});
				}
				else {
					toastr.error("Could not remove Port");
				}
			});
	}
}


function validate_ssh_key() {
	let value = $("#ssh_key").val();
	let split_vals = value.split(" ");
	if (split_vals.length == 3 && split_vals[1].length % 4 == 0 && /[0-9A-Za-z\+\/]/.test(split_vals[1])){
		return true;
	}
	return false;
}

function add_ssh_key() {
	if (!validate_ssh_key()){
		toastr.warning("The SSH Key is not valid", "Validation Failed");
	} else {
		let csrf_token = $("[name=csrfmiddlewaretoken]").val();
		let value = $("#ssh_key").val();
		let split_vals = value.split(" ");
		fetch("/sshkey/", {
			method: "post",
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json',
				'X-CSRFToken': csrf_token
			},
			body: JSON.stringify({
				key_type: split_vals[0],
				key: split_vals[1],
				comment: split_vals[2],
			})
		}).then(data => {
			if (data.status != 200)
				data.json().then(data => {
					toastr.error(data.message, "Could not add key!");
				});
			else {
				render_keys().then((data) => {
					toastr.success("Key was successfully added to your account", "Success!");
				});
			}
		});
	}
}

function add_port() {
	let csrf_token = $("[name=csrfmiddlewaretoken]").val();
	let name = $("#portNameField").val();
	let source_port = $("#sourcePortField").val();
	if (name == "" || source_port == "") {
		toastr.error("Form was not filled correctly", "Could not add key!");
		return;
	}
	if (state_port == false) {
		state_port = true;
		fetch("/ports/", {
			method: "post",
			headers: {
				'Accept': 'application/json',
				'Content-Type': 'application/json',
				'X-CSRFToken': csrf_token
			},
			body: JSON.stringify({
				source_port: source_port,
				name: name
			})
		}).then(resp => {
			state_port = false;
			if (resp.status != 201)
				resp.json().then(data => {
					toastr.error(data.message, "Could not add Port!");
				});
			else {
				render_ports().then((data) => {
					toastr.success("Port was successfully added to your account", "Success!");
				});
			}
		});
	} else {
		toastr.warning("Cannot perform two actions at once", "Oops!");
	}
}



$(document).ready(function() {
	$("#create-service-button:not(.bound)").addClass("bound").click(function () {
		create(this);
	});
	$(".check-jobs:not(.bound)").addClass("bound").click(function () {
		loop(true);
	});
	$(".link:not(.bound)").addClass("bound").click(function () {
		clear_active(this);
	});
	$(".add-ssh-key:not(.bound)").addClass("bound").click(function () {
		add_ssh_key();
	});
	$(".ssh-key-delete:not(.bound)").addClass("bound").click(function () {
		delete_sshkey(this);
	});
	$(".refresh-ports-button:not(.bound)").addClass("bound").click(function () {
		render_ports().then (data => {});
	});
	$(".create-port-button:not(.bound)").addClass("bound").click(function () {
		add_port();
	});
    render_services().then(data => {
		// attach the functions to button clicks
		loop(true);
		setInterval(() => loop(true), 10000); // run forced loop every 10 seconds
		setInterval(() => loop(), 5000); // run forced loop every 5 seconds
		// load active tab
		load_active_tab();
		current_services = data;
		render_ports().then((data) => {} ).catch(e => {});
	});
	load_active_tab();
	render_keys().then((data) => {} );
	toastr.options.closeButton = true;
});
