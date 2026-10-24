import { gql } from "graphql-tag";
import { GraphQLError } from "graphql";
import { manifest } from "../config.ts";
import type { Context } from "../connectionResolvers.ts";
import { SAMPLE_READ } from "../permissions.ts";

// Every type and operation is prefixed with the plugin name: the gateway
// composes all plugins into one supergraph, so names must be unique across it.
export const typeDefs = gql`
  extend schema @link(url: "https://specs.apollo.dev/federation/v2.9", import: ["@key"])

  type PhoenixStatus {
    plugin: String!
    version: String!
    subdomain: String!
    userId: String
    userEmail: String
  }

  type PhoenixSample {
    _id: String!
    label: String!
    createdAt: String
  }

  type Query {
    phoenixStatus: PhoenixStatus!
    phoenixSamples(limit: Int = 20, offset: Int = 0): [PhoenixSample!]!
  }
`;

export const resolvers = {
  Query: {
    phoenixStatus: (_parent: unknown, _args: unknown, { subdomain, user }: Context) => ({
      plugin: manifest.name,
      version: manifest.version,
      subdomain,
      userId: user?._id ?? null,
      userEmail: user?.email ?? null,
    }),
    phoenixSamples: async (
      _parent: unknown,
      { limit = 20, offset = 0 }: { limit?: number; offset?: number },
      { models, user, subdomain, checkPermission }: Context,
    ) => {
      if (!user?._id) {
        throw new GraphQLError("Login required", { extensions: { code: "UNAUTHENTICATED" } });
      }
      if (!subdomain) {
        throw new GraphQLError("Tenant required", { extensions: { code: "FORBIDDEN" } });
      }
      await checkPermission(SAMPLE_READ);
      if (!Number.isInteger(limit) || limit < 1 || limit > 100 ||
          !Number.isInteger(offset) || offset < 0 || offset > 10_000) {
        throw new GraphQLError("Use limit 1–100 and offset 0–10000", {
          extensions: { code: "BAD_USER_INPUT" },
        });
      }
      return (await models.Samples.list({ limit, offset })).map((sample) => ({
        ...sample,
        createdAt: sample.createdAt?.toISOString?.() ?? null,
      }));
    },
  },
};
