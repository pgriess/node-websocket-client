# This makefile exists to help run tests.
#
# We depend on an installation of miksago-node-websocket-server. We'll
# include $HOME/src/miksago-node-websocket-server/lib in $NODE_PATH by
# default. An alternate location can be specified by setting the
# NODE_WS_SERVER_PATH make variable when invoking make.

NODE_WS_SERVER_PATH ?= $(HOME)/src/miksago-node-websocket-server/lib

.PHONY: test

test:
	for f in `ls -1 test/test-*.js` ; do \
		NODE_PATH=./lib:$(NODE_WS_SERVER_PATH):$$NODE_PATH node $$f ; \
	done
