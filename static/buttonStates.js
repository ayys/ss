let BUTTON_SPINNER_CLASSES = "fa-circle-o-notch fa-spin fa-lg";

export function disable_all_buttons_except(service_id, except) {
    $(`#${service_id}-stop`).hide();
    $(`#${service_id}-start`).hide();
    $(`#${service_id}-restart`).hide();

    $(`#${service_id}-${except}`).show();
}

export function enable_all_buttons(service_id) {
    $(`#${service_id}-stop`).show();
    $(`#${service_id}-start`).show();
    $(`#${service_id}-restart`).show();
}


export function button_stop(service_id) {
    $(`#${service_id}-stop-icon`).toggleClass("fa-stop");
    $(`#${service_id}-stop-icon`).toggleClass(BUTTON_SPINNER_CLASSES);
    disable_all_buttons_except(service_id, "stop");
}

export function button_delete(service_id) {
    $(`#${service_id}-delete-icon`).toggleClass("fa-trash-alt");
    $(`#${service_id}-delete-icon`).toggleClass(BUTTON_SPINNER_CLASSES);
    disable_all_buttons_except(service_id, "delete");
}


export function button_start(service_id) {
    $(`#${service_id}-start-icon`).toggleClass("fa-play");
    $(`#${service_id}-start-icon`).toggleClass(BUTTON_SPINNER_CLASSES);
    disable_all_buttons_except(service_id, "start");
}

export function button_restart(service_id) {
    $(`#${service_id}-restart-icon`).toggleClass("fa-refresh");
    $(`#${service_id}-restart-icon`).toggleClass(BUTTON_SPINNER_CLASSES);
    disable_all_buttons_except(service_id, "restart");
}

export function button_toggle_autopilot(service_id) {
    $(`#${service_id}-toggle-autopilot-icon`).toggleClass("fa-tachometer-alt");
    $(`#${service_id}-toggle-autopilot-icon`).toggleClass(BUTTON_SPINNER_CLASSES);
    disable_all_buttons_except(service_id, "toggle-autopilot");
}
