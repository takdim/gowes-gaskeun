"""Handler Socket.IO (realtime live map)."""
from flask_socketio import join_room, leave_room


def register_socket_handlers(socketio):
    """Daftarkan semua event handler ke instance socketio."""

    @socketio.on("connect")
    def handle_connect():
        pass

    @socketio.on("disconnect")
    def handle_disconnect():
        pass

    @socketio.on("subscribe-event")
    def handle_subscribe(data):
        event_id = data.get("eventId")
        if event_id:
            join_room(f"event_{event_id}")

    @socketio.on("unsubscribe-event")
    def handle_unsubscribe(data):
        event_id = data.get("eventId")
        if event_id:
            leave_room(f"event_{event_id}")

    @socketio.on_error
    def handle_error(e):
        print(f"WebSocket error: {e}")
