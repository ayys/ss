import {getJobs, getJob} from "./base.js";
import {button_restart, button_start, button_stop, button_delete, enable_all_buttons} from "./buttonStates.js";


let jobs = [];


let state_fetching = false;

function clear_active(el) {
	$(".link").each( (index, element) => {
		if ($(element).attr("href") != $(el).attr("href"))
			$(element).removeClass("active");
		else if (element != el && !$(element).hasClass("active")) {
			$(element).addClass("active");
		}
	} );
	let href = $(el).attr("href");
	console.log(href);
	localStorage.setItem("active_tab", href);
}


async function fetch_services(){
	if (!state_fetching){
		// wait for 2 seconds to reduce server crowding
		await new Promise(res => setTimeout(res, 2000));
		state_fetching = true;
		return fetch("/service/s/").then(resp => resp.json().then(data => {
			state_fetching = false;
			data.results.forEach((service) => service['minutes_left'] = function() {
				return ((new Date() - this.creation_time) / 1000 / 60).toFixed(0);
			});
			return {
				response: resp,
				services : data.results
			};
		}));
	}
	return null;
}

function set_services_tab(services){
	let services_tab_heading = $("#servicesTabHeadingTemplate").render({count: services.length});
	let services_tab = $("#servicesTabTemplate").render(services);
	$("#servicestab").html(services_tab_heading).append(services_tab);
    $(".link").click(function () {
		clear_active(this);
    });
}

function set_services_tabpane(services){
	let service_panes = $("#serviceTemplate").render(services);
	let tabcontent = $("#actions-tabcontent");
	$(".generated-service-tab").remove();
	$("#actions-tabcontent").append(service_panes);
}

async function render_services() {
	return fetch_services().then(data => {
		let services = [];
		if (data.response.status ==  200){
			services = data.services;
			set_services_tab(services);
			set_services_tabpane(services);
		}
		else console.log("Oh No!", data);
		return services;
	});
}

function loop(force=false) {
    // force is set to true by events such as button press which need to immediately call the function
    if (force == false && jobs.length == 0) return;
    getJobs().then((data) => {
		if (data.length < jobs.length) {
			// check if the job was completed or if it threw errors
			data.forEach((job, index) => {
				if (job.status == "finished", "Success!")
					toastr.success(job.description);
				else if (job.status == "failed")
					toastr.error(job.description, "Oops!");
			});
			render_services().then((data) => {
				toastr.success("Services updated", "Success!");
			});
		} else if (data.length > jobs.length) {
			jobs = data;
			jobs.forEach((job) => toastr.info(job.description));
		}
		jobs = data;
		if (jobs.length  > 0){
			// add all the new jobs to the jobs tab
			var el = $("#currently-running-jobs");
			var tab = $("#jobs-tab");
			var html = "";
			tab.html( `<i class="fas fa-lg fa-running" style='min-width:30px;'></i> View Running Jobs <span class='badge badge-danger'>${jobs.length}</span>`);
			for (let job of jobs) {
				let icon = '';
				if (job.status == "queued") {
					icon = 'far fa-lg fa-clock';
				} else icon = 'fa fa-cog fa-spin fa-lg fa-fw';
				html += `
                         <div class="card mb-2">
			 	<div class="card-body">
			 		<i style="min-width: 30px;" class="${icon}"></i> Job : ${job.description}
			 	</div>
			 </div>`;
			}
			el.html(html);
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
		console.log(data);
		if (data.status == 200)
			loop(true);				// force loop to call API
		else {
			data.json().then(json_data => {
				console.log(data);
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
    let hostname = $("[name=domain-hostname]").val();
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
    var domain_id = $(button).attr("ssh-key-id");
    let csrf_token = $("[name=csrfmiddlewaretoken]").val();
    fetch(`/sshkey/${domain_id}/`, {
		method: "delete",
		headers: {
			'X-CSRFToken': csrf_token
		}}).then(data => {
			if (data.status == 204) {
				render_services().then((data) => {
					toastr.success("Successfully removed SSH Key");
				});
			}
			else {
				data.json().then(data => {
					toastr.error(data.message, "Could not remove SSH Key");
				});
			}
		});
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
					toastr.error(data.message, "Could not create service!");
				});
			else {
				render_services().then((data) => {
					toastr.success("Service successfully created", "Success!");
				});
			}
		});
	}
}

$(document).ready(function() {
    render_services().then(data => {
		console.log("Hello world");
	    $(".button-service-stop").click(function () {
			stop(this);
		});
		$(".button-service-start").click(function() {
			start(this);
		});
		$(".button-service-restart").click(function () {
			restart(this);
		});
		$(".button-service-delete").click(function () {
			s_delete(this);
		});
		$(".button-service-create").click(function () {
			create(this);
		});
		$(".button-service-toggle-autopilot").click(function () {
			toggle_autopilot(this);
		});
		$(".button-service-add-domain").click(function () {
			add_domain(this);
		});
		$(".button-service-delete-domain").click(function () {
			delete_domain(this);
		});
		$(".button-service-refresh-snapshot").click(function () {
			refresh_snapshot(this);
		});
		$(".button-service-restore-snapshot").click(function () {
			restore_snapshot(this);
		});
		$(".check-jobs").click(function () {
			loop(true);
		});
		$(".link").click(function () {
			clear_active(this);
		});
		$(".add-ssh-key").click(function () {
			add_ssh_key();
		});
		$(".ssh-key-delete").click(function () {
			delete_sshkey(this);
		});
		$(".link").click(function () {
			clear_active(this);
		});
		// attach the functions to button clicks
		loop(true);
		setInterval(() => loop(true), 10000); // run forced loop every 10 seconds
		setInterval(() => loop(), 5000); // run forced loop every 5 seconds


		// load active tab
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
	});
});
